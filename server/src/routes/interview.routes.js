import express from 'express';
import {
  getSession,
  startInterview,
  recordAnswer,
  addQuestion,
  finaliseInterview,
  MAX_QUESTIONS,
  MAX_JD_QUESTIONS,
} from '../store/session.js';
import {
  generateFirstQuestion,
  generateNextQuestion,
  buildCategorySequence,
} from '../services/interviewService.js';
import { evaluateAnswer, generateReport } from '../services/evaluationService.js';

const router = express.Router();

// Valid interview modes accepted by the API
const VALID_MODES = new Set(['hr', 'technical', 'dsa', 'behavioral', 'ai_llm', 'mixed', 'job_specific']);

/**
 * POST /api/interview/start
 *
 * Requires a prior POST /api/profile to have been called (session must have
 * profile + analysis stored).  Profile state is preserved across interviews —
 * only the interview sub-state is reset here.
 *
 * Body (optional):
 *   { mode: string }  — one of: hr | technical | dsa | behavioral | ai_llm | mixed | job_specific
 *                       Defaults to "mixed" if omitted or invalid.
 *
 * Response 200:
 * {
 *   message        : string,
 *   mode           : string,
 *   questionIndex  : 1,
 *   totalQuestions : number,
 *   question       : string
 * }
 */
router.post('/interview/start', async (req, res, next) => {
  try {
    const { profile, analysis, jdData } = getSession();

    if (!profile || !analysis) {
      return res.status(400).json({
        error: 'No candidate profile found. Please submit a profile via POST /api/profile first.',
      });
    }

    // Resolve and validate mode; fall back to "mixed"
    const rawMode = (req.body?.mode ?? 'mixed').toLowerCase().trim();
    const mode    = VALID_MODES.has(rawMode) ? rawMode : 'mixed';

    if (!VALID_MODES.has(rawMode)) {
      console.warn(`[interview/start] Unknown mode "${rawMode}", defaulting to "mixed".`);
    }

    // job_specific mode requires JD data; fall back to mixed if absent
    if (mode === 'job_specific' && !jdData?.jdMatch) {
      console.warn('[interview/start] job_specific requested but no JD data found — falling back to mixed.');
    }

    // Determine total questions for this session
    const totalQuestions = mode === 'job_specific' ? MAX_JD_QUESTIONS : MAX_QUESTIONS;

    // Enrich analysis with JD focus topics when in job_specific mode
    const effectiveAnalysis = (mode === 'job_specific' && jdData?.jdMatch?.jdFocusTopics?.length)
      ? { ...analysis, focusTopics: jdData.jdMatch.jdFocusTopics }
      : analysis;

    // Build the category sequence for this session up-front
    const categorySequence = buildCategorySequence(mode, effectiveAnalysis, totalQuestions);
    console.log(`[interview/start] Mode: ${mode} | Total: ${totalQuestions} | Sequence: ${categorySequence.join(' → ')}`);

    // Generate the first question using the first slot in the sequence
    const firstQuestion = await generateFirstQuestion(profile, effectiveAnalysis, categorySequence);

    // Persist interview state (profile + analysis are NOT touched)
    startInterview(firstQuestion, mode, categorySequence, totalQuestions);

    return res.status(200).json({
      message:        'Interview started',
      mode,
      questionIndex:  1,
      totalQuestions,
      question:       firstQuestion,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/answer
 *
 * Body: { answer: string }
 *
 * Evaluates the current answer, records it, then either:
 *   - generates and returns the next question  (if < MAX_QUESTIONS answered), or
 *   - generates the final report               (if all questions are answered).
 *
 * Mid-interview response 200:
 * {
 *   message       : string,
 *   evaluation    : object,          — scores + feedback for this answer
 *   questionIndex : number,          — index of the NEXT question
 *   totalQuestions: number,
 *   question      : string           — next question to ask
 * }
 *
 * Final response 200:
 * {
 *   message       : string,
 *   evaluation    : object,          — scores + feedback for the last answer
 *   finished      : true,
 *   report        : object           — final holistic report
 * }
 */
router.post('/interview/answer', async (req, res, next) => {
  try {
    const session = getSession();
    const { profile, analysis, jdData, interview } = session;

    if (!profile || !analysis) {
      return res.status(400).json({
        error: 'No candidate profile found. Please submit a profile via POST /api/profile first.',
      });
    }

    if (!interview.started) {
      return res.status(400).json({
        error: 'Interview not started. Please call POST /api/interview/start first.',
      });
    }

    if (interview.finished) {
      return res.status(400).json({
        error: 'This interview is already complete. Start a new one via POST /api/interview/start.',
      });
    }

    const { answer = '' } = req.body;

    // Determine which question we are currently answering
    // questions[] has totalAsked items; answers[] has totalAsked-1 so far
    const currentQuestionIndex = interview.answers.length + 1; // 1-based
    const currentQuestion = interview.questions[currentQuestionIndex - 1];

    if (!currentQuestion) {
      return res.status(400).json({
        error: 'No pending question to answer.',
      });
    }

    // ── Evaluate the answer ──────────────────────────────────────────────────
    const evaluation = await evaluateAnswer(
      profile,
      analysis,
      currentQuestion,
      answer.trim(),
      currentQuestionIndex,
    );

    // Persist answer + evaluation to session
    recordAnswer(answer.trim(), evaluation);

    const answeredCount  = currentQuestionIndex; // equals interview.answers.length after recordAnswer
    const totalQuestions = interview.totalQuestions ?? MAX_QUESTIONS;

    // ── Final question answered → generate report ────────────────────────────
    if (answeredCount >= totalQuestions) {
      const updatedSession = getSession();
      const report = await generateReport(
        profile,
        analysis,
        updatedSession.interview.questions,
        updatedSession.interview.answers,
        updatedSession.interview.evaluations,
        jdData?.jdMatch ?? null,
      );
      finaliseInterview(report);

      return res.status(200).json({
        message:    'Interview complete',
        evaluation: { questionIndex: currentQuestionIndex, question: currentQuestion, ...evaluation },
        finished:   true,
        report,
      });
    }

    // ── More questions remain → generate next question ───────────────────────
    const updatedSession = getSession();
    const effectiveAnalysis = (interview.mode === 'job_specific' && jdData?.jdMatch?.jdFocusTopics?.length)
      ? { ...analysis, focusTopics: jdData.jdMatch.jdFocusTopics, weaknesses: Array.from(new Set([...analysis.weaknesses, ...jdData.jdMatch.skillGaps])) }
      : analysis;

    const nextQuestion = await generateNextQuestion(
      profile,
      effectiveAnalysis,
      updatedSession.interview.questions,
      updatedSession.interview.categorySequence,
    );
    addQuestion(nextQuestion);

    return res.status(200).json({
      message:        'Answer recorded',
      evaluation:     { questionIndex: currentQuestionIndex, question: currentQuestion, ...evaluation },
      questionIndex:  currentQuestionIndex + 1,
      totalQuestions,
      question:       nextQuestion,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
