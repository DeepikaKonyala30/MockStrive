/**
 * interviewService.js
 * Interview Question Generation Agent.
 *
 * Generates one interview question at a time via IBM watsonx.ai.
 * Primary model: Meta Llama 3.3 70B Instruct; fallback: IBM Granite 8B.
 *
 * Supported modes:
 *   hr          — all 7 questions are HR
 *   technical   — all 7 questions are Technical
 *   dsa         — all 7 questions are DSA
 *   behavioral  — all 7 questions are Behavioral
 *   ai_llm      — all 7 questions are AI/LLM
 *   mixed       — AI-determined distribution totalling 7 (fallback: 3T/1D/1HR/1B/1J)
 *   job_specific— all 7 questions are Job-Specific (derived from JD focus topics)
 *
 * For the "mixed" mode the profile analysis interviewStrategy.questionDistribution
 * is used when available (profile analysis is done first); the hard-coded fallback
 * above ensures correctness even if the strategy is absent.
 *
 * Public API:
 *   buildCategorySequence(mode, analysis)              → string[]  (7 elements)
 *   generateQuestion(profile, analysis, askedQuestions, category) → string
 */

import { queryWatsonx } from './watsonx.js';
import { MAX_QUESTIONS } from '../store/session.js';

// ─── Category definitions ──────────────────────────────────────────────────────

/**
 * Canonical category labels used in prompts.
 * Keys match the mode names and the interviewStrategy distribution keys.
 */
const CATEGORY_LABELS = {
  technical:    'Technical',
  dsa:          'Data Structures & Algorithms (DSA)',
  hr:           'HR / Cultural Fit',
  behavioral:   'Behavioral (STAR method)',
  ai_llm:       'AI / LLM / Machine Learning',
  job_specific: 'Job-Specific',
};

// ─── Category sequence builder ─────────────────────────────────────────────────

/**
 * buildCategorySequence
 * Returns an ordered array of `totalQuestions` category labels for the session.
 * This sequence is computed once at interview start and stored in the session so
 * every subsequent question knows its category without any random re-picks.
 *
 * @param {string} mode           — interview mode chosen by the user
 * @param {object} analysis       — profile analysis (may contain interviewStrategy)
 * @param {number} [totalQuestions] — how many slots to fill (default MAX_QUESTIONS)
 * @returns {string[]}            — array of category label strings
 */
export const buildCategorySequence = (mode, analysis, totalQuestions = MAX_QUESTIONS) => {
  // ── Pure single-category modes ──────────────────────────────────────────────
  const singleModeMap = {
    hr:           'hr',
    technical:    'technical',
    dsa:          'dsa',
    behavioral:   'behavioral',
    ai_llm:       'ai_llm',
    job_specific: 'job_specific',
  };

  if (singleModeMap[mode]) {
    return Array(totalQuestions).fill(CATEGORY_LABELS[singleModeMap[mode]]);
  }

  // ── Mixed mode: use strategy distribution if available, else fixed fallback ─
  let dist;
  if (analysis?.interviewStrategy?.questionDistribution) {
    dist = analysis.interviewStrategy.questionDistribution;
  } else {
    // Hard-coded mixed fallback: 3T / 1D / 1HR / 1B / 1JS = 7 total
    dist = { technical: 3, dsa: 1, hr: 1, behavioral: 1, ai_llm: 0 };
  }

  // Expand distribution into a flat list
  const expanded = [];
  for (const [key, count] of Object.entries(dist)) {
    if (CATEGORY_LABELS[key] && count > 0) {
      for (let i = 0; i < count; i++) expanded.push(CATEGORY_LABELS[key]);
    }
  }

  // Ensure exactly totalQuestions entries
  while (expanded.length < totalQuestions) expanded.push(CATEGORY_LABELS.technical);
  if (expanded.length > totalQuestions) expanded.length = totalQuestions;

  // Shuffle so the categories don't always appear in the same order
  for (let i = expanded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
  }

  return expanded;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the question generation prompt.
 *
 * @param {object}   profile
 * @param {object}   analysis
 * @param {string[]} askedQuestions  — questions already asked in this session
 * @param {string}   category        — one of the CATEGORY_LABELS values
 * @returns {string}
 */
function buildQuestionPrompt(profile, analysis, askedQuestions, category) {
  // Send only the last 3 asked questions to keep prompt context small
  const recentAsked = askedQuestions.slice(-3);
  const askedBlock = recentAsked.length
    ? `Previously asked (DO NOT REPEAT): ${recentAsked.map((q, i) => `\n${i + 1}. ${q}`).join('')}`
    : '';

  // Category-specific guidance injected into the prompt
  const categoryGuidance = {
    [CATEGORY_LABELS.technical]: 'Probe technical skills and focus topics.',
    [CATEGORY_LABELS.dsa]: 'Ask a concrete data structures/algorithms question.',
    [CATEGORY_LABELS.hr]: 'Explore motivation, culture fit, or career goals.',
    [CATEGORY_LABELS.behavioral]: 'Ask a STAR-format behavioral question.',
    [CATEGORY_LABELS.ai_llm]: 'Ask about AI/ML concepts, LLMs, or prompt engineering.',
    [CATEGORY_LABELS.job_specific]: 'Ask a highly specific question covering the COMPLETE Job Description (required/preferred skills, responsibilities, real-world scenarios, role-specific concepts). Do NOT focus repeatedly on a single technology or requirement.',
  };

  const guidance = categoryGuidance[category] ?? 'Generate an interview question.';

  return `<|system|>
You are an expert interviewer conducting a ${analysis.difficulty} difficulty interview for a ${analysis.candidateLevel} ${profile.targetRole}.
Generate exactly ONE "${category}" question.

Rules:
- Keep the question under 40 words. Ask it naturally, as a real interviewer would.
- Strictly respect the candidateLevel (${analysis.candidateLevel}) and difficulty (${analysis.difficulty}). Junior/Easy candidates receive beginner-to-intermediate questions only.
- Avoid advanced topics (e.g., DP, Graphs, Topological Sort, LCA, System Design, Median Stream) unless candidateLevel is Senior or above.
- Prioritize the candidate's weak areas and skill gaps. Avoid generic or repetitive questions.
- ${guidance}
- Output the question text ONLY. No preamble, labels, or numbering.
<|user|>
Strengths: ${analysis.strengths.join(', ')}
Weaknesses / Skill Gaps: ${analysis.weaknesses.join(', ')}
Focus Topics: ${analysis.focusTopics.join(', ')}
${askedBlock}

Generate one new "${category}" question now.
<|assistant|>
`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateFirstQuestion
 * Generates the opening question for a new interview session.
 * The category to use is the first entry in the pre-built categorySequence.
 *
 * @param {object}   profile
 * @param {object}   analysis
 * @param {string[]} categorySequence — pre-built sequence from buildCategorySequence()
 * @returns {Promise<string>}
 */
export const generateFirstQuestion = async (profile, analysis, categorySequence) => {
  const category = categorySequence[0] ?? CATEGORY_LABELS.technical;
  const prompt   = buildQuestionPrompt(profile, analysis, [], category);

  console.log(`[interviewService] Generating first question (category: ${category})…`);
  const raw = await queryWatsonx(prompt, { max_new_tokens: 120, temperature: 0.7 });
  const question = raw.trim().replace(/^["']|["']$/g, '');

  return question;
};

/**
 * generateNextQuestion
 * Generates the next question using the pre-planned category for this slot.
 * Avoids repetition of questions already asked.
 *
 * @param {object}   profile
 * @param {object}   analysis
 * @param {string[]} askedQuestions   — all questions asked so far
 * @param {string[]} categorySequence — pre-built sequence from buildCategorySequence()
 * @returns {Promise<string>}
 */
export const generateNextQuestion = async (profile, analysis, askedQuestions, categorySequence) => {
  // The next slot index equals the number of questions already asked
  const slotIndex = askedQuestions.length;
  const category  = categorySequence[slotIndex] ?? CATEGORY_LABELS.technical;
  const prompt    = buildQuestionPrompt(profile, analysis, askedQuestions, category);

  console.log(`[interviewService] Generating next question (slot: ${slotIndex + 1}, category: ${category})…`);
  const raw = await queryWatsonx(prompt, { max_new_tokens: 120, temperature: 0.7 });
  const question = raw.trim().replace(/^["']|["']$/g, '');

  return question;
};
