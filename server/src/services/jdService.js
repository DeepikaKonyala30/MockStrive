/**
 * jdService.js
 * Job Description Skill-Match Agent.
 *
 * analyzeJdMatch — given a candidate profile + job description text, asks
 *                  IBM Granite to perform a gap analysis and return:
 *                  skillMatchPercent, matchingSkills, missingSkills,
 *                  interviewReadiness, technologiesToImprove, jdFocusTopics.
 *
 * Reuses the existing queryWatsonx transport — no new AI services.
 */

import { queryWatsonx } from './watsonx.js';

// ─── Shared JSON extractor ────────────────────────────────────────────────────

function extractJson(raw, service) {
  try { return JSON.parse(raw); } catch (_) { /* continue */ }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) { /* continue */ }
  }

  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { /* continue */ }
  }

  throw new Error(
    `[${service}] Could not extract valid JSON from model response.\n` +
    `Raw: ${raw.slice(0, 400)}`
  );
}

// ─── JD Skill-Match Analysis ──────────────────────────────────────────────────

function buildJdMatchPrompt(profile, jdText) {
  const truncatedJd     = jdText.slice(0, 3000);

  const profileBlock = [
    `Name: ${profile.fullName || 'N/A'}`,
    `Target Role: ${profile.targetRole || 'N/A'}`,
    `Experience: ${profile.experienceLevel || 'N/A'}`,
    `Skills: ${profile.skills || 'N/A'}`,
    `Education: ${profile.education || 'N/A'}`,
    profile.resumeSummary ? `Summary: ${profile.resumeSummary}` : '',
  ].filter(Boolean).join('\n');

  return `<|system|>
You are a senior technical recruiter performing a profile-to-job-description gap analysis.
Compare the candidate's profile against the job description below.

Output valid JSON only — no markdown, no prose, no code fences.
Schema:
{
  "skillMatchPercent":     <integer 0-100 — overall skill match percentage>,
  "matchingSkills":        ["<skill present in both profile and JD>", ...],
  "missingSkills":         ["<skill required by JD but absent from profile>", ...],
  "interviewReadiness":    "<one of: Not Ready | Partially Ready | Ready | Highly Ready>",
  "technologiesToImprove": ["<specific technology or topic the candidate must strengthen>", ...],
  "jdFocusTopics":         ["<concrete interview topic derived directly from JD requirements>", ...]
}
Constraints:
- matchingSkills: 3-10 items
- missingSkills: 1-8 items (empty array if no gaps found)
- technologiesToImprove: 2-6 items
- jdFocusTopics: 4-8 items (these will guide interview question generation)
- skillMatchPercent must honestly reflect the overlap, not be inflated
<|user|>
Candidate Profile:
${profileBlock}

Job Description:
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
    matchingSkills:        toArr(parsed.matchingSkills),
    missingSkills:         toArr(parsed.missingSkills),
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
 * @returns {Promise<object>} — { skillMatchPercent, matchingSkills, missingSkills,
 *                               interviewReadiness, technologiesToImprove, jdFocusTopics }
 */
export const analyzeJdMatch = async (profile, jdText) => {
  if (!jdText || !jdText.trim()) {
    throw new Error('[jdService] Job description text is empty.');
  }

  const prompt = buildJdMatchPrompt(profile, jdText);

  console.log('[jdService] Performing JD skill-match analysis…');
  const raw = await queryWatsonx(prompt, { max_new_tokens: 700, temperature: 0.2 });
  console.log('[jdService] Raw JD match response:', raw.slice(0, 200));

  const parsed  = extractJson(raw, 'jdService/jdMatch');
  const jdMatch = validateJdMatch(parsed);

  console.log('[jdService] JD match complete — skillMatch:', jdMatch.skillMatchPercent + '%');
  return jdMatch;
};
