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

import { queryWatsonxJson, extractJsonRobust } from './watsonx.js';

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
You are an expert interviewer evaluating a candidate's answer.
Internally reason about the answer's quality, identifying specific strengths, weaknesses, and skill gaps.

Rules:
- 'strengths': State EXACTLY what the candidate did correctly in the context of this specific question. Do not use generic phrases like "attempted to answer" or "good effort".
- 'weaknesses': Identify the specific concept, logic, or explanation that was missing or incorrect. Do not use generic phrases like "needs more detail" or "improve communication".
- 'learningTopics': Only list concrete concepts or technologies to study next. Do not say "learn more".
- 'feedback' (AI Coach Tip): Give exactly ONE practical exercise related to the current question (max 2 sentences). Never repeat weaknesses. Never start with "You should..." or "To improve...". Start with an action verb (e.g., "Build a small REST API...").
- Job-Specific: If assessing a Job-Specific question, evaluate how well the answer aligns with the overall job role and responsibilities, not just a single mentioned skill.
- Every evaluation must feel highly personalized to the candidate's actual answer. Avoid all generic filler.
- Do NOT repeat the question or answer.
- Output valid JSON only.

Schema:
{
  "overallScore": <0-100>,
  "technicalScore": <0-100 (0 if non-technical)>,
  "communicationScore": <0-100>,
  "strengths": ["<what the candidate did well>"],
  "weaknesses": ["<what was technically/conceptually missing>"],
  "learningTopics": ["<concepts or technologies to study>"],
  "feedback": "<One practical exercise starting with an action verb (max 2 sentences)>"
}
<|user|>
Role: ${profile.targetRole} (${analysis.candidateLevel}, ${analysis.difficulty})
Question: ${question}
Answer: ${answer || '(no answer provided)'}
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
    `Q${i + 1}: Score ${e.overallScore}. Feedback: ${e.feedback}`
  ).join('\n');

  return `<|system|>
You are a senior interview coach writing a final post-interview report.
Synthesise the evaluations into a concise, insightful assessment.

Rules:
- Infer overall strengths and weaknesses from the evaluations. Do NOT repeat inputs.
- 'learningTopics' should combine overall skill gaps, missing skills, and a learning plan.
- 'summary' must act as an AI Coach Summary (2-3 lines max). It must clearly explain WHY the overall score was given and state interview readiness.
- Keep all text concise. Avoid verbose explanations.
- Output valid JSON only.

Schema:
{
  "overallScore": <0-100 average>,
  "technicalScore": <0-100 average>,
  "communicationScore": <0-100 average>,
  "strengths": ["<consistent strengths>"],
  "weaknesses": ["<recurring weaknesses>"],
  "learningTopics": ["<overall skill gap and learning plan>"],
  "summary": "<2-3 lines explaining WHY the score was given and readiness>"
}
<|user|>
Role: ${profile.targetRole} (${analysis.candidateLevel})
Evaluations:
${evalSummary}
<|assistant|>
`;
}

// JSON extraction delegated to the shared extractJsonRobust in watsonx.js.
const extractJson = (raw) => extractJsonRobust(raw, 'evaluationService');

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
 * Send a question + answer pair to watsonx.ai and return a structured evaluation.
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
  const evaluation = await queryWatsonxJson(prompt, extractJson, validateEvaluation, { max_new_tokens: 250, temperature: 0.2 });

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
  const report = await queryWatsonxJson(prompt, extractJson, validateReport, { max_new_tokens: 400, temperature: 0.2 });

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
