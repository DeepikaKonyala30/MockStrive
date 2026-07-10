import express from 'express';
import { analyzeProfile } from '../services/profileService.js';
import { setSession }     from '../store/session.js';

const router = express.Router();

/**
 * POST /api/profile
 *
 * Body (all strings):
 *   fullName, targetRole, experienceLevel, education, skills, resumeSummary
 *
 * Response 200:
 *   {
 *     message  : string,
 *     profile  : { ...input fields },
 *     analysis : { candidateLevel, difficulty, strengths, weaknesses, focusTopics }
 *   }
 */
router.post('/profile', async (req, res, next) => {
  try {
    const {
      fullName       = '',
      targetRole     = '',
      experienceLevel = '',
      education      = '',
      skills         = '',
      resumeSummary  = '',
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────────
    const missing = [];
    if (!fullName.trim())        missing.push('fullName');
    if (!targetRole.trim())      missing.push('targetRole');
    if (!experienceLevel.trim()) missing.push('experienceLevel');
    if (!skills.trim())          missing.push('skills');

    if (missing.length) {
      return res.status(400).json({
        error:  'Missing required fields',
        fields: missing,
      });
    }

    // ── Build clean profile object ────────────────────────────────────────────
    const profile = {
      fullName:        fullName.trim(),
      targetRole:      targetRole.trim(),
      experienceLevel: experienceLevel.trim(),
      education:       education.trim(),
      skills:          skills.trim(),
      resumeSummary:   resumeSummary.trim(),
    };

    // ── Call Profile Analysis Agent ───────────────────────────────────────────
    const analysis = await analyzeProfile(profile);

    // ── Persist to in-memory session ──────────────────────────────────────────
    setSession(profile, analysis);

    return res.status(200).json({
      message:  'Profile analysed successfully',
      profile,
      analysis,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
