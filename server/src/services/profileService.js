/**
 * profileService.js
 * Profile Analysis Agent.
 *
 * Sends the complete candidate profile to IBM Granite and asks it to reason
 * holistically about seniority, interview difficulty, strengths, weaknesses,
 * focus topics, and an interview strategy.
 * Post-processing is limited to JSON extraction and a structural validity check —
 * Granite's reasoning is never overridden.
 *
 * Returned shape:
 * {
 *   candidateLevel     : string   — e.g. "Mid-Level"
 *   difficulty         : string   — "Easy" | "Medium" | "Hard"
 *   strengths          : string[]
 *   weaknesses         : string[]
 *   focusTopics        : string[]
 *   interviewStrategy  : {
 *     questionDistribution : { technical: n, dsa: n, hr: n, behavioral: n, ai_llm: n }
 *     estimatedDuration    : string  — e.g. "25–35 minutes"
 *   }
 * }
 */

import { queryWatsonx } from './watsonx.js';

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the holistic analysis prompt.
 * The instruction emphasises genuine reasoning over any mechanical mapping.
 *
 * @param {object} profile
 * @returns {string}
 */
function buildAnalysisPrompt(profile) {
  const { fullName, targetRole, experienceLevel, education, skills, resumeSummary } = profile;

  return `<|system|>
You are a senior technical recruiter and interview coach with deep expertise across software engineering roles.
Analyse the candidate profile below holistically — considering all fields together, not in isolation.

Important reasoning rules:
- Do not assume a skill listed is a weakness. Listed skills are likely areas of competence.
- Infer seniority from the combination of experience level, skills breadth, education, and resume content — not from any single field.
- Weaknesses should reflect genuine gaps, missing skills for the target role, or areas the profile does not substantiate.
- focusTopics should be specific subjects the interview should probe to fairly assess this candidate for the target role.
- difficulty reflects the appropriate challenge level for this candidate: Easy for genuine beginners, Medium for mid-level practitioners, Hard for advanced or senior candidates.
- interviewStrategy.questionDistribution must have exactly 5 questions total spread across the categories that best suit this candidate and role. At minimum 1 Technical, and the rest distributed as makes sense (HR, Behavioral, DSA, AI_LLM). DSA should only be non-zero for software engineering / data roles. AI_LLM should only be non-zero if the role explicitly involves AI or machine learning.
- estimatedDuration should reflect the difficulty and question count (typically 20–45 minutes for 5 questions).

Respond with valid JSON only — no markdown, no prose, no code fences.
Schema:
{
  "candidateLevel": "<one of: Junior, Mid-Level, Senior, Lead, Principal>",
  "difficulty": "<one of: Easy, Medium, Hard>",
  "strengths": ["<specific strength observed in the profile>", ...],
  "weaknesses": ["<genuine gap or unsubstantiated area for the target role>", ...],
  "focusTopics": ["<concrete topic to assess in interview>", ...],
  "interviewStrategy": {
    "questionDistribution": {
      "technical":  <integer 0-5>,
      "dsa":        <integer 0-5>,
      "hr":         <integer 0-5>,
      "behavioral": <integer 0-5>,
      "ai_llm":     <integer 0-5>
    },
    "estimatedDuration": "<e.g. 25-35 minutes>"
  }
}
Constraints: 3-5 strengths, 2-4 weaknesses, 3-6 focusTopics. questionDistribution values must sum to exactly 5.
<|user|>
Candidate: ${fullName || 'Not provided'}
Target Role: ${targetRole || 'Not provided'}
Self-reported Experience Level: ${experienceLevel || 'Not provided'}
Education: ${education || 'Not provided'}
Skills: ${skills || 'Not provided'}
Resume Summary: ${resumeSummary || 'Not stated'}
<|assistant|>
`;
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

/**
 * Extracts and parses the first JSON object from a raw model response string.
 * Handles markdown fences and leading/trailing prose.
 *
 * @param {string} raw
 * @returns {object}
 */
function extractJson(raw) {
  // Direct parse — ideal path
  try { return JSON.parse(raw); } catch (_) { /* continue */ }

  // Strip markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) { /* continue */ }
  }

  // First { … } block
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { /* continue */ }
  }

  throw new Error(
    '[profileService] Could not extract valid JSON from model response.\n' +
    `Raw: ${raw.slice(0, 400)}`
  );
}

// ─── Structural validator ─────────────────────────────────────────────────────

/**
 * Validates that the parsed object has the required fields with expected types.
 * Does NOT replace Granite's values — only enforces structural completeness.
 * Falls back gracefully on non-critical shape deviations.
 *
 * @param {object} parsed
 * @returns {object}
 */
function validateAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[profileService] Model returned non-object JSON.');
  }

  const toStringArray = (v) =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : [];

  const toInt = (v, fallback = 0) =>
    Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : fallback;

  const candidateLevel = typeof parsed.candidateLevel === 'string' && parsed.candidateLevel.trim()
    ? parsed.candidateLevel.trim()
    : (() => { throw new Error('[profileService] Missing candidateLevel in model response.'); })();

  const difficulty = typeof parsed.difficulty === 'string' && parsed.difficulty.trim()
    ? parsed.difficulty.trim()
    : (() => { throw new Error('[profileService] Missing difficulty in model response.'); })();

  const strengths   = toStringArray(parsed.strengths);
  const weaknesses  = toStringArray(parsed.weaknesses);
  const focusTopics = toStringArray(parsed.focusTopics);

  if (!strengths.length || !focusTopics.length) {
    throw new Error('[profileService] Model returned empty strengths or focusTopics arrays.');
  }

  // ── Interview strategy ────────────────────────────────────────────────────
  // Parse model's questionDistribution; fall back to a sensible default if missing/malformed.
  const rawStrategy = parsed.interviewStrategy ?? {};
  const rawDist     = rawStrategy.questionDistribution ?? {};

  const distribution = {
    technical:  toInt(rawDist.technical,  2),
    dsa:        toInt(rawDist.dsa,        1),
    hr:         toInt(rawDist.hr,         1),
    behavioral: toInt(rawDist.behavioral, 1),
    ai_llm:     toInt(rawDist.ai_llm,     0),
  };

  // Ensure the distribution sums to exactly MAX_QUESTIONS (5).
  // If the model over- or under-counted, scale proportionally then trim/pad technical.
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total !== 5) {
    console.warn(`[profileService] questionDistribution sums to ${total}, normalising to 5.`);
    if (total === 0) {
      distribution.technical  = 2;
      distribution.dsa        = 1;
      distribution.hr         = 1;
      distribution.behavioral = 1;
    } else {
      // Scale each value proportionally (rounded), then adjust technical to fix remainder
      const scale  = 5 / total;
      let runningSum = 0;
      for (const key of ['dsa', 'hr', 'behavioral', 'ai_llm']) {
        distribution[key] = Math.round(distribution[key] * scale);
        runningSum += distribution[key];
      }
      distribution.technical = 5 - runningSum;
      if (distribution.technical < 0) distribution.technical = 0;
    }
  }

  const estimatedDuration =
    typeof rawStrategy.estimatedDuration === 'string' && rawStrategy.estimatedDuration.trim()
      ? rawStrategy.estimatedDuration.trim()
      : '25–35 minutes';

  const interviewStrategy = { questionDistribution: distribution, estimatedDuration };

  return { candidateLevel, difficulty, strengths, weaknesses, focusTopics, interviewStrategy };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * analyzeProfile
 * Build prompt → call Granite → extract JSON → structural validation → return.
 *
 * @param {object} profile
 * @returns {Promise<{candidateLevel, difficulty, strengths, weaknesses, focusTopics}>}
 */
export const analyzeProfile = async (profile) => {
  const prompt = buildAnalysisPrompt(profile);

  console.log('[profileService] Sending profile to IBM Granite for holistic analysis…');
  const raw = await queryWatsonx(prompt, { max_new_tokens: 700, temperature: 0.3 });
  console.log('[profileService] Raw model response:', raw.slice(0, 300));

  const parsed   = extractJson(raw);
  const analysis = validateAnalysis(parsed);

  console.log('[profileService] Analysis complete:', JSON.stringify(analysis));
  return analysis;
};
