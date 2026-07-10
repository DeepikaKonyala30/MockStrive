export const STATE_KEY = 'interviewIQState';
export const SESSION_REPORT_KEY = 'interviewIQReport';
export const SESSION_EVALS_KEY = 'interviewIQEvaluations';

/**
 * Get the full InterviewIQ state from localStorage.
 */
export function getInterviewState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Update the InterviewIQ state in localStorage.
 * Overwrites only the provided fields.
 */
export function updateInterviewState(updates) {
  try {
    const currentState = getInterviewState() || {};
    const newState = { ...currentState, ...updates };
    localStorage.setItem(STATE_KEY, JSON.stringify(newState));
    return newState;
  } catch (_) {
    return null;
  }
}

/**
 * Clear the InterviewIQ state entirely (Reset Profile).
 */
export function clearInterviewState() {
  try {
    localStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(SESSION_REPORT_KEY);
    sessionStorage.removeItem(SESSION_EVALS_KEY);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Get the session-based interview report.
 */
export function getInterviewReport() {
  try {
    const raw = sessionStorage.getItem(SESSION_REPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Set the session-based interview report.
 */
export function setInterviewReport(report) {
  try {
    sessionStorage.setItem(SESSION_REPORT_KEY, JSON.stringify(report));
  } catch (_) {
    /* ignore */
  }
}

/**
 * Store individual evaluations temporarily during the interview.
 */
export function setInterviewEvaluations(evaluations) {
  try {
    sessionStorage.setItem(SESSION_EVALS_KEY, JSON.stringify(evaluations));
  } catch (_) {
    /* ignore */
  }
}
