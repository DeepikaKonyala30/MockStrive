/**
 * evaluationService.js
 * Interview Evaluation & Learning Agent + Final Report Generator.
 *
 * evaluateAnswer  — scores a single answer across five dimensions and
 *                   returns a structured evaluation object.
 * generateReport  — synthesises all per-answer evaluations into a final
 *                   holistic report once all 5 questions are answered.
 *
 * Evaluation shape (per answer):
 * {
 *   questionIndex       : number   — 1-based
 *   question            : string
 *   answer              : string
 *   overallScore        : number   — 0-100
 *   technicalScore      : number   — 0-100
 *   communicationScore  : number   — 0-100
 *   strengths           : string[]
 *   weaknesses          : string[]
 *   learningTopics      : string[]
 *   feedback            : string
 * }
 *
 * Final report shape:
 * {
 *   candidateName       : string
 *   targetRole          : string
 *   candidateLevel      : string
 *   overallScore        : number   — average across all answers
 *   technicalScore      : number
 *   communicationScore  : number
 *   strengths           : string[]
 *   weaknesses          : string[]
 *   learningTopics      : string[]
 *   summary             : string
 *   evaluations         : object[] — all per-answer evaluations
 * }
 */

import { queryWatsonx } from './watsonx.js';

// ─── Evaluation prompt ────────────────────────────────────────────────────────

/**
 * Builds the answer-evaluation prompt.
 *
 * @param {object} profile
 * @param {object} analysis
 * @param {string} question
 * @param {string} answer
 * @param {number} questionIndex  — 1-based
 * @returns {string}
 */
function buildEvaluationPrompt(profile, analysis, question, answer, questionIndex) {
  return `<|system|>
You are an expert technical interview evaluator assessing a candidate's response.
Evaluate the answer below on five dimensions and return a structured JSON assessment.

Scoring dimensions (each 0–100):
- overallScore: holistic score combining all dimensions
- technicalScore: accuracy, depth, and correctness of technical content (0 if non-technical question)
- communicationScore: clarity, structure, and articulation of the response

Output valid JSON only — no markdown, no prose, no code fences.
Schema:
{
  "overallScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "communicationScore": <integer 0-100>,
  "strengths": ["<what the candidate did well>", ...],
  "weaknesses": ["<specific gap or improvement area>", ...],
  "learningTopics": ["<topic the candidate should study based on this answer>", ...],
  "feedback": "<2-4 sentences of constructive, specific feedback>"
}
Constraints: 1-3 strengths, 1-3 weaknesses, 1-3 learningTopics.
<|user|>
Candidate: ${profile.fullName}
Target Role: ${profile.targetRole} (${analysis.candidateLevel})
Interview Difficulty: ${analysis.difficulty}

Question ${questionIndex}: ${question}

Candidate Answer: ${answer || '(no answer provided)'}
<|assistant|>
`;
}

// ─── Report prompt ────────────────────────────────────────────────────────────

/**
 * Builds the final report generation prompt.
 *
 * @param {object}   profile
 * @param {object}   analysis
 * @param {object[]} evaluations  — all per-answer evaluation objects
 * @returns {string}
 */
function buildReportPrompt(profile, analysis, evaluations) {
  const evalSummary = evaluations.map((e, i) =>
    `Q${i + 1}: "${e.question}"\n  Score: ${e.overallScore}/100 | Technical: ${e.technicalScore}/100 | Communication: ${e.communicationScore}/100\n  Feedback: ${e.feedback}`
  ).join('\n\n');

  return `<|system|>
You are a senior interview coach writing a comprehensive post-interview report.
Synthesise the per-question evaluations below into a holistic final assessment.

Output valid JSON only — no markdown, no prose, no code fences.
Schema:
{
  "overallScore": <integer 0-100, average of all question scores>,
  "technicalScore": <integer 0-100, average of technical scores>,
  "communicationScore": <integer 0-100, average of communication scores>,
  "strengths": ["<consistent strength shown across the interview>", ...],
  "weaknesses": ["<recurring weakness or gap>", ...],
  "learningTopics": ["<prioritised study topic for the candidate>", ...],
  "summary": "<3-5 sentences: honest, specific, actionable overall assessment>"
}
Constraints: 3-5 strengths, 2-4 weaknesses, 3-5 learningTopics.
<|user|>
Candidate: ${profile.fullName}
Target Role: ${profile.targetRole}
Candidate Level: ${analysis.candidateLevel}
Interview Difficulty: ${analysis.difficulty}

Per-question evaluations:
${evalSummary}
<|assistant|>
`;
}

// ─── JSON extraction (shared) ─────────────────────────────────────────────────

function extractJson(raw) {
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
    '[evaluationService] Could not extract valid JSON from model response.\n' +
    `Raw: ${raw.slice(0, 400)}`
  );
}

// ─── Validators ───────────────────────────────────────────────────────────────

function validateEvaluation(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[evaluationService] Evaluation: model returned non-object JSON.');
  }

  const toInt   = (v, fallback = 50) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback;
  const toArr   = (v) => Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  const toStr   = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : '';

  return {
    overallScore:       toInt(parsed.overallScore),
    technicalScore:     toInt(parsed.technicalScore),
    communicationScore: toInt(parsed.communicationScore),
    strengths:          toArr(parsed.strengths),
    weaknesses:         toArr(parsed.weaknesses),
    learningTopics:     toArr(parsed.learningTopics),
    feedback:           toStr(parsed.feedback),
  };
}

function validateReport(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[evaluationService] Report: model returned non-object JSON.');
  }

  const toInt = (v, fallback = 50) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback;
  const toArr = (v) => Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  const toStr = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : '';

  return {
    overallScore:       toInt(parsed.overallScore),
    technicalScore:     toInt(parsed.technicalScore),
    communicationScore: toInt(parsed.communicationScore),
    strengths:          toArr(parsed.strengths),
    weaknesses:         toArr(parsed.weaknesses),
    learningTopics:     toArr(parsed.learningTopics),
    summary:            toStr(parsed.summary),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * evaluateAnswer
 * Send a question + answer pair to Granite and return a structured evaluation.
 *
 * @param {object} profile
 * @param {object} analysis
 * @param {string} question
 * @param {string} answer
 * @param {number} questionIndex  — 1-based
 * @returns {Promise<object>}  — evaluation object (without question/answer embedded)
 */
export const evaluateAnswer = async (profile, analysis, question, answer, questionIndex) => {
  const prompt = buildEvaluationPrompt(profile, analysis, question, answer, questionIndex);

  console.log(`[evaluationService] Evaluating answer for Q${questionIndex}…`);
  const raw = await queryWatsonx(prompt, { max_new_tokens: 600, temperature: 0.2 });
  console.log('[evaluationService] Raw evaluation response:', raw.slice(0, 300));

  const parsed     = extractJson(raw);
  const evaluation = validateEvaluation(parsed);

  console.log(`[evaluationService] Q${questionIndex} evaluation — overall: ${evaluation.overallScore}`);
  return evaluation;
};

/**
 * generateReport
 * Synthesises all per-answer evaluations into a final holistic report.
 * When jdMatch is provided, it is embedded in the report so the frontend can
 * display skill-match data without an extra API call.
 *
 * @param {object}      profile
 * @param {object}      analysis
 * @param {string[]}    questions    — ordered list of all questions asked
 * @param {string[]}    answers      — ordered list of all candidate answers
 * @param {object[]}    evaluations  — ordered list of all per-answer evaluations
 * @param {object|null} [jdMatch]    — JD skill-match data (optional)
 * @returns {Promise<object>}        — final report object
 */
export const generateReport = async (profile, analysis, questions, answers, evaluations, jdMatch = null) => {
  // Merge question + answer into each evaluation for the prompt context
  const enrichedEvals = evaluations.map((ev, i) => ({
    ...ev,
    question: questions[i] || '',
    answer:   answers[i]   || '',
  }));

  const prompt = buildReportPrompt(profile, analysis, enrichedEvals);

  console.log('[evaluationService] Generating final report…');
  const raw = await queryWatsonx(prompt, { max_new_tokens: 800, temperature: 0.2 });
  console.log('[evaluationService] Raw report response:', raw.slice(0, 300));

  const parsed = extractJson(raw);
  const report = validateReport(parsed);

  // Attach metadata, full evaluation trail, and optional JD match data
  return {
    candidateName:  profile.fullName,
    targetRole:     profile.targetRole,
    candidateLevel: analysis.candidateLevel,
    ...report,
    evaluations: enrichedEvals,
    // jdMatch is null when no JD was provided; the frontend checks for its presence
    jdMatch: jdMatch ?? null,
  };
};
