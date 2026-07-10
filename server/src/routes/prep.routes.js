/**
 * prep.routes.js
 * Interview Preparation endpoints.
 *
 * POST /api/prep/jd/analyze
 *   Accepts a job description text, calls IBM Granite for a gap analysis,
 *   stores the result in session, and returns it.
 *   Requires a profile to already exist in session (from POST /api/profile).
 */

import express from 'express';
import { analyzeJdMatch } from '../services/jdService.js';
import { getSession, setJdData } from '../store/session.js';

const router = express.Router();

// ── POST /api/prep/jd/analyze ────────────────────────────────────────────────

router.post('/prep/jd/analyze', async (req, res, next) => {
  try {
    const { jdText = '' } = req.body;

    if (!jdText.trim()) {
      return res.status(400).json({ error: 'jdText is required and must not be empty.' });
    }

    const { profile } = getSession();
    if (!profile) {
      return res.status(400).json({
        error: 'No candidate profile found. Submit a profile via POST /api/profile first.',
      });
    }

    const jdMatch = await analyzeJdMatch(profile, jdText.trim());

    // Persist in session so the interview route and report can access it
    setJdData(jdText.trim(), jdMatch);

    return res.status(200).json({
      message: 'Job description analysed successfully',
      jdMatch,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
