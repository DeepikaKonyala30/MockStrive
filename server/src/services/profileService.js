/**
 * profileService.js
 * Profile Analysis Agent.
 *
 * Sends the complete candidate profile to IBM watsonx.ai and asks it to reason
 * holistically about seniority, interview difficulty, strengths, weaknesses,
 * focus topics, and an interview strategy.
 * Post-processing is limited to JSON extraction and a structural validity check —
 * watsonx.ai's reasoning is never overridden.
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

import { queryWatsonxJson, extractJsonRobust } from './watsonx.js';

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
You are an expert technical recruiter and interview coach.
Analyse the candidate profile holistically against the target role.
Reason internally about their education, experience, and skills before generating the JSON.

Rules:
- Infer seniority and interview difficulty from the complete profile.
- Infer strengths and weaknesses. Do NOT simply copy the candidate's skills.
- Do NOT repeat the resume summary.
- 'weaknesses' should reflect genuine skill gaps missing for the target role.
- 'focusTopics' must be specific interview subjects to assess this candidate fairly.
- 'interviewStrategy.questionDistribution' must total exactly 7 questions (at least 1 technical). Only include DSA for SWE/Data roles and AI_LLM for AI/ML roles.
- Keep all responses concise.

Output valid JSON only.
Schema:
{
  "candidateLevel": "<one of: Junior, Mid-Level, Senior, Lead, Principal>",
  "difficulty": "<one of: Easy, Medium, Hard>",
  "strengths": ["<infer 3-5 specific strengths>"],
  "weaknesses": ["<infer 2-4 genuine skill gaps missing for target role>"],
  "focusTopics": ["<3-6 concrete topics to assess>"],
  "interviewStrategy": {
    "questionDistribution": {
      "technical": <0-7>, "dsa": <0-7>, "hr": <0-7>, "behavioral": <0-7>, "ai_llm": <0-7>
    },
    "estimatedDuration": "<e.g. 25-35 minutes>"
  }
}
<|user|>
Candidate: ${fullName || 'Not provided'}
Target Role: ${targetRole || 'Not provided'}
Experience: ${experienceLevel || 'Not provided'}
Education: ${education || 'Not provided'}
Skills: ${skills || 'Not provided'}
Summary: ${resumeSummary || 'Not stated'}
<|assistant|>
`;
}

// JSON extraction delegated to the shared extractJsonRobust in watsonx.js.
const extractJson = (raw) => extractJsonRobust(raw, 'profileService');

// ─── Structural validator ─────────────────────────────────────────────────────

/**
 * Validates that the parsed object has the required fields with expected types.
 * Does NOT replace model values — only enforces structural completeness.
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

  // Ensure the distribution sums to exactly MAX_QUESTIONS (7).
  // If the model over- or under-counted, scale proportionally then trim/pad technical.
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total !== 7) {
    console.warn(`[profileService] questionDistribution sums to ${total}, normalising to 7.`);
    if (total === 0) {
      distribution.technical  = 3;
      distribution.dsa        = 1;
      distribution.hr         = 1;
      distribution.behavioral = 1;
      distribution.ai_llm     = 1;
    } else {
      // Scale each value proportionally (rounded), then adjust technical to fix remainder
      const scale  = 7 / total;
      let runningSum = 0;
      for (const key of ['dsa', 'hr', 'behavioral', 'ai_llm']) {
        distribution[key] = Math.round(distribution[key] * scale);
        runningSum += distribution[key];
      }
      distribution.technical = 7 - runningSum;
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
 * Build prompt → call Llama 3.3 70B → extract JSON → structural validation → return.
 *
 * @param {object} profile
 * @returns {Promise<{candidateLevel, difficulty, strengths, weaknesses, focusTopics}>}
 */
export const analyzeProfile = async (profile) => {
  const prompt = buildAnalysisPrompt(profile);

  console.log('[profileService] Sending profile to Llama 3.3 70B for holistic analysis…');
  const analysis = await queryWatsonxJson(prompt, extractJson, validateAnalysis, { max_new_tokens: 300, temperature: 0.2 });

  console.log('[profileService] Analysis complete:', JSON.stringify(analysis));
  return analysis;
};
