import profileRouter   from './profile.routes.js';
import interviewRouter from './interview.routes.js';
import reportRouter    from './report.routes.js';
import prepRouter      from './prep.routes.js';
import express from 'express';

const router = express.Router();

router.use(profileRouter);
router.use(interviewRouter);
router.use(reportRouter);
router.use(prepRouter);

export default router;
