/**
 * session.js — In-memory session store
 *
 * Holds the live interview session state for a single concurrent user
 * (single-user foundation — no auth, no DB).
 *
 * Profile and analysis are stored independently from interview state so that
 * users can start a new interview without re-submitting their profile.
 * Only an explicit profile submission overwrites the profile/analysis.
 *
 * Shape:
 * {
 *   profile     : { fullName, targetRole, experienceLevel, education, skills, resumeSummary } | null
 *   analysis    : {
 *                   candidateLevel, difficulty, strengths, weaknesses, focusTopics,
 *                   interviewStrategy: { questionDistribution, estimatedDuration }
 *                 } | null
 *   jdData      : {
 *                   jdText           : string   — raw job description text
 *                   jdMatch          : {
 *                     skillMatchPercent, matchingSkills, missingSkills,
 *                     interviewReadiness, technologiesToImprove, jdFocusTopics
 *                   }
 *                 } | null
 *   interview   : {
 *     mode        : string          — "hr" | "technical" | "dsa" | "behavioral" | "ai_llm" | "mixed" | "job_specific"
 *     started     : boolean
 *     finished    : boolean
 *     totalAsked  : number          — count of questions asked so far (max 5)
 *     categorySequence : string[]   — pre-planned category for each question slot
 *     questions   : string[]        — ordered list of questions asked
 *     answers     : string[]        — candidate answers in matching order
 *     evaluations : object[]        — per-answer evaluation objects from Granite
 *     report      : object | null   — final report once interview is complete
 *   }
 * }
 */

export const MAX_QUESTIONS    = 5;
export const MAX_JD_QUESTIONS = 8;   // job_specific mode asks more targeted questions

const _makeInterview = () => ({
  mode:             'mixed',
  started:          false,
  finished:         false,
  totalAsked:       0,
  totalQuestions:   5,   // can be overridden at startInterview() time
  categorySequence: [],
  questions:        [],
  answers:          [],
  evaluations:      [],
  report:           null,
});

let _session = {
  profile:   null,
  analysis:  null,
  jdData:    null,
  interview: _makeInterview(),
};

/**
 * Overwrite candidate profile + analysis.
 * Does NOT reset interview state — a new interview can still be started
 * separately via startInterview().
 */
export const setProfile = (profile, analysis) => {
  _session.profile  = profile;
  _session.analysis = analysis;
};

/**
 * Store JD-related data (raw text + match analysis).
 * Kept separate from profile so the profile route stays unchanged.
 *
 * @param {string} jdText
 * @param {object} jdMatch — output from resumeService.analyzeJdMatch
 */
export const setJdData = (jdText, jdMatch) => {
  _session.jdData = { jdText, jdMatch };
};

/** Clear JD data without touching anything else. */
export const clearJdData = () => {
  _session.jdData = null;
};

/**
 * setSession — kept for backward compatibility; delegates to setProfile.
 * @deprecated use setProfile instead
 */
export const setSession = (profile, analysis) => setProfile(profile, analysis);

/** Read a shallow copy of the full session. */
export const getSession = () => ({ ..._session });

/**
 * Reset the interview state and record the first question.
 * The mode is stored so question generators can pick the right category.
 *
 * @param {string}   firstQuestion
 * @param {string}   mode              — interview mode chosen by the user
 * @param {string[]} categorySequence  — pre-planned category for each question slot
 * @param {number}   [totalQuestions]  — total questions for this session (default 5)
 */
export const startInterview = (firstQuestion, mode, categorySequence, totalQuestions) => {
  _session.interview = {
    ..._makeInterview(),
    mode,
    started:          true,
    totalAsked:       1,
    totalQuestions:   totalQuestions ?? MAX_QUESTIONS,
    categorySequence: categorySequence ?? [],
    questions:        [firstQuestion],
  };
};

/**
 * Record a submitted answer and its evaluation.
 * @param {string} answer
 * @param {object} evaluation — structured evaluation from Granite
 */
export const recordAnswer = (answer, evaluation) => {
  _session.interview.answers.push(answer);
  _session.interview.evaluations.push(evaluation);
};

/**
 * Append the next question and increment the counter.
 * @param {string} question
 */
export const addQuestion = (question) => {
  _session.interview.totalAsked += 1;
  _session.interview.questions.push(question);
};

/** Store the final report and mark the interview as finished. */
export const finaliseInterview = (report) => {
  _session.interview.finished = true;
  _session.interview.report   = report;
};

/** Clear only the interview state (keep profile + analysis). */
export const resetInterview = () => {
  _session.interview = _makeInterview();
};
