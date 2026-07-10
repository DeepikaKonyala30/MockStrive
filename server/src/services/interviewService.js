/**
 * interviewService.js
 * Interview Question Generation Agent.
 *
 * Generates one interview question at a time using IBM Granite.
 * Each interview mode enforces a strict category sequence so that only the
 * correct question types are asked.  Difficulty and focus topics come from
 * the AI profile analysis.  Previously asked questions are passed to the model
 * to avoid repetition.
 *
 * Supported modes:
 *   hr          — all 5 questions are HR
 *   technical   — all 5 questions are Technical
 *   dsa         — all 5 questions are DSA
 *   behavioral  — all 5 questions are Behavioral
 *   ai_llm      — all 5 questions are AI/LLM
 *   mixed       — 2 Technical, 1 DSA, 1 HR, 1 Behavioral  (fixed distribution)
 *   job_specific— all 5 questions are Job-Specific (derived from the candidate's role/skills)
 *
 * For the "mixed" mode the profile analysis interviewStrategy.questionDistribution
 * is used when available (profile analysis is done first); the hard-coded fallback
 * above ensures correctness even if the strategy is absent.
 *
 * Public API:
 *   buildCategorySequence(mode, analysis)              → string[]  (5 elements)
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
    // Hard-coded mixed fallback: 2 Technical, 1 DSA, 1 HR, 1 Behavioral
    dist = { technical: 2, dsa: 1, hr: 1, behavioral: 1, ai_llm: 0 };
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
  const askedBlock = askedQuestions.length
    ? `Questions already asked (do NOT repeat or paraphrase these):\n${askedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : 'No questions have been asked yet.';

  // Category-specific guidance injected into the prompt
  const categoryGuidance = {
    [CATEGORY_LABELS.technical]:
      'Probe the candidate\'s technical skills, system design knowledge, and the identified focus topics.',
    [CATEGORY_LABELS.dsa]:
      'Ask about data structures, algorithms, time/space complexity analysis, or coding problem-solving. Be concrete and role-appropriate.',
    [CATEGORY_LABELS.hr]:
      'Explore motivation, culture fit, career goals, values, or team dynamics.',
    [CATEGORY_LABELS.behavioral]:
      'Ask a STAR-format (Situation, Task, Action, Result) question probing leadership, conflict resolution, collaboration, or ownership.',
    [CATEGORY_LABELS.ai_llm]:
      'Ask about AI/ML concepts, LLM architectures, prompt engineering, fine-tuning, evaluation, or responsible AI practices relevant to the role.',
    [CATEGORY_LABELS.job_specific]:
      'Ask a question directly tied to the specific responsibilities, tools, or domain knowledge required for this exact role.',
  };

  const guidance = categoryGuidance[category] ?? 'Generate an appropriate interview question for this candidate.';

  return `<|system|>
You are a professional interview panel member conducting a ${analysis.difficulty}-difficulty interview.
Generate exactly ONE "${category}" interview question for the candidate described below.

Rules:
- The question must match the "${analysis.difficulty}" difficulty level.
- The question must be appropriate for a ${analysis.candidateLevel} candidate targeting the role of ${profile.targetRole}.
- Category guidance: ${guidance}
- The question must be fresh — do not repeat or closely paraphrase any question already asked.
- Output the question text only — no preamble, no category label, no numbering, no explanation.
<|user|>
Candidate: ${profile.fullName}
Target Role: ${profile.targetRole}
Candidate Level: ${analysis.candidateLevel}
Strengths: ${analysis.strengths.join(', ')}
Focus Topics: ${analysis.focusTopics.join(', ')}
${askedBlock}

Generate one "${category}" question now.
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
  const raw = await queryWatsonx(prompt, { max_new_tokens: 200, temperature: 0.7 });
  const question = raw.trim().replace(/^["']|["']$/g, '');

  console.log('[interviewService] First question:', question);
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

  console.log(`[interviewService] Generating next question (slot: ${slotIndex + 1}, category: ${category}, asked: ${askedQuestions.length})…`);
  const raw = await queryWatsonx(prompt, { max_new_tokens: 200, temperature: 0.7 });
  const question = raw.trim().replace(/^["']|["']$/g, '');

  console.log('[interviewService] Next question:', question);
  return question;
};
