import express from 'express';
import { getSession } from '../store/session.js';

const router = express.Router();

/**
 * GET /api/report
 *
 * Returns the final interview report for the current session.
 * The report is only available after all 5 questions have been answered
 * via POST /api/interview/answer.
 *
 * Response 200 (report available):
 * {
 *   message : string,
 *   report  : {
 *     candidateName, targetRole, candidateLevel,
 *     overallScore, technicalScore, communicationScore,
 *     strengths, weaknesses, learningTopics, summary,
 *     evaluations
 *   }
 * }
 *
 * Response 404 (interview not finished yet):
 * { error: string }
 */
router.get('/report', (req, res) => {
  const { interview, profile } = getSession();

  if (!profile) {
    return res.status(404).json({
      error: 'No active session. Submit a profile via POST /api/profile first.',
    });
  }

  if (!interview.finished || !interview.report) {
    return res.status(404).json({
      error: 'Report not yet available. Complete all interview questions first.',
    });
  }

  return res.status(200).json({
    message: 'Report retrieved successfully',
    report:  interview.report,
  });
});

export default router;
