/**
 * jdService.js
 * Job Description Skill-Match Agent.
 *
 * analyzeJdMatch — given a candidate profile + job description text, calls
 *                  IBM watsonx.ai (Llama 3.3 70B / Granite 8B fallback) for a gap analysis and return:
 *                  skillMatchPercent, keyStrengths, skillGaps,
 *                  interviewReadiness, technologiesToImprove, jdFocusTopics.
 *
 * Reuses the existing queryWatsonx transport — no new AI services.
 */

import { queryWatsonxJson, extractJsonRobust } from './watsonx.js';

// JSON extraction delegated to the shared extractJsonRobust in watsonx.js.

// ─── JD Skill-Match Analysis ──────────────────────────────────────────────────

function buildJdMatchPrompt(profile, jdText) {
  const truncatedJd     = jdText.slice(0, 3000);

  const profileBlock = [
    `Role: ${profile.targetRole || 'N/A'}`,
    `Experience: ${profile.experienceLevel || 'N/A'}`,
    `Skills: ${profile.skills || 'N/A'}`,
    `Education: ${profile.education || 'N/A'}`,
    profile.resumeSummary ? `Summary: ${profile.resumeSummary}` : '',
  ].filter(Boolean).join('\n');

  return `<|system|>
You are an expert technical recruiter performing a profile-to-JD gap analysis.
Rules:
- Analyze the broader competencies required for the target role.
- Do not classify individual technologies as missing; instead, identify capability gaps (e.g., "Limited experience with cloud deployment" rather than "Missing AWS").
- Generate 'keyStrengths' highlighting the candidate's strongest alignments with the JD.
- Generate 'skillGaps' describing broader capability gaps.
- 'technologiesToImprove' should be practical learning recommendations.
- 'jdFocusTopics' should guide the interview strategy based on the identified gaps.
- Keep responses concise, practical, and personalized.

Output valid JSON only.
Schema:
{
  "skillMatchPercent": <integer 0-100 honest match>,
  "keyStrengths": ["<3-6 broader strengths aligning with JD>"],
  "skillGaps": ["<2-4 capability gaps>"],
  "interviewReadiness": "<Not Ready | Partially Ready | Ready | Highly Ready>",
  "technologiesToImprove": ["<2-5 prioritized learning recommendations>"],
  "jdFocusTopics": ["<4-8 concrete interview topics based on gaps>"]
}
<|user|>
Profile:
${profileBlock}

JD:
${truncatedJd}
<|assistant|>
`;
}

function validateJdMatch(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[jdService] JD match: model returned non-object JSON.');
  }

  const toInt = (v, fallback = 50) =>
    Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Math.round(Number(v)))) : fallback;
  const toArr = (v) => Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  const toStr = (v, fallback = '') =>
    (typeof v === 'string' && v.trim()) ? v.trim() : fallback;

  const VALID_READINESS = new Set(['Not Ready', 'Partially Ready', 'Ready', 'Highly Ready']);
  const rawReadiness    = toStr(parsed.interviewReadiness);
  const interviewReadiness = VALID_READINESS.has(rawReadiness) ? rawReadiness : 'Partially Ready';

  return {
    skillMatchPercent:     toInt(parsed.skillMatchPercent),
    keyStrengths:          toArr(parsed.keyStrengths),
    skillGaps:             toArr(parsed.skillGaps),
    interviewReadiness,
    technologiesToImprove: toArr(parsed.technologiesToImprove),
    jdFocusTopics:         toArr(parsed.jdFocusTopics),
  };
}

/**
 * analyzeJdMatch
 * Compares the candidate's profile against a job description.
 *
 * @param {object} profile    — candidate profile object
 * @param {string} jdText     — raw job description text
 * @returns {Promise<object>} — { skillMatchPercent, keyStrengths, skillGaps,
 *                               interviewReadiness, technologiesToImprove, jdFocusTopics }
 */
export const analyzeJdMatch = async (profile, jdText) => {
  if (!jdText || !jdText.trim()) {
    throw new Error('[jdService] Job description text is empty.');
  }

  const prompt = buildJdMatchPrompt(profile, jdText);

  console.log('[jdService] Performing JD skill-match analysis…');
  const jdMatch = await queryWatsonxJson(
    prompt,
    (raw) => extractJsonRobust(raw, 'jdService'),
    validateJdMatch,
    { max_new_tokens: 300, temperature: 0.2 }
  );

  console.log('[jdService] JD match complete — skillMatch:', jdMatch.skillMatchPercent + '%');
  return jdMatch;
};
