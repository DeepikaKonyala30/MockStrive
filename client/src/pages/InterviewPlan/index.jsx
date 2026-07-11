import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiTarget, FiClock, FiLayers,
  FiMessageSquare, FiArrowRight, FiArrowLeft, FiCpu, FiAlertCircle,
} from 'react-icons/fi';
import { Button } from '../../components/index.js';
import { getInterviewState } from '../../utils/storage.js';
import styles from './InterviewPlan.module.css';

// Must match MAX_QUESTIONS / MAX_JD_QUESTIONS in server/src/store/session.js
const MAX_QUESTIONS    = 7;
const MAX_JD_QUESTIONS = 7;

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ── Category colour map ───────────────────────────────────────────────────── */
const CAT_COLOR = {
  technical:    '#8b5cf6',
  dsa:          '#06b6d4',
  hr:           '#3b82f6',
  behavioral:   '#10b981',
  ai_llm:       '#f59e0b',
  job_specific: '#ec4899',
};
const CAT_LABEL = {
  technical:    'Technical',
  dsa:          'DSA',
  hr:           'HR / Cultural Fit',
  behavioral:   'Behavioral',
  ai_llm:       'AI / LLM',
  job_specific: 'Job-Specific',
};
const MODE_LABEL = {
  hr:           'HR',
  technical:    'Technical',
  dsa:          'DSA',
  behavioral:   'Behavioral',
  ai_llm:       'AI / LLM',
  mixed:        'Mixed',
  job_specific: 'Job-Specific',
};

/**
 * buildBreakdown
 * Returns [ { label, count, color } ] for the given mode.
 *
 * - Single-category modes: all totalQuestions go to that category.
 * - Mixed mode: reads questionDistribution from analysis; sums must equal totalQuestions.
 */
function buildBreakdown(mode, analysis, totalQuestions) {
  if (mode !== 'mixed') {
    const key = mode; // e.g. 'hr', 'technical', 'dsa', etc.
    return [{ label: CAT_LABEL[key] ?? mode, count: totalQuestions, color: CAT_COLOR[key] ?? '#6366f1' }];
  }

  // Mixed: use AI-determined distribution when available
  const dist = analysis?.interviewStrategy?.questionDistribution;
  if (dist) {
    return Object.entries(dist)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({
        label: CAT_LABEL[key] ?? key,
        count,
        color: CAT_COLOR[key] ?? '#6366f1',
      }));
  }

  // Fallback if distribution not yet available (shouldn't happen in normal flow)
  return [
    { label: 'Technical',     count: 3, color: CAT_COLOR.technical },
    { label: 'DSA',           count: 1, color: CAT_COLOR.dsa },
    { label: 'HR / Cultural Fit', count: 1, color: CAT_COLOR.hr },
    { label: 'Behavioral',    count: 1, color: CAT_COLOR.behavioral },
    { label: 'AI / LLM',      count: 1, color: CAT_COLOR.ai_llm },
  ];
}

function InterviewPlan() {
  const location = useLocation();
  const navigate = useNavigate();

  const savedState = getInterviewState() || {};
  const analysis  = location.state?.analysis ?? savedState.analysis;
  const jdMatch   = location.state?.jdMatch  ?? savedState.jdMatch;
  const mode      = location.state?.mode ?? savedState.mode ?? 'mixed';

  if (!analysis) {
    return <NoProfileGuard navigate={navigate} />;
  }

  const totalQuestions   = mode === 'job_specific' ? MAX_JD_QUESTIONS : MAX_QUESTIONS;
  const estimatedDuration = analysis.interviewStrategy?.estimatedDuration ?? '25–35 min';
  const breakdown        = buildBreakdown(mode, analysis, totalQuestions);

  return (
    <motion.div
      className={`${styles.page} page-wrapper`}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="container">

        {/* Header */}
        <motion.div
          className={styles.header}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className={styles.badge} variants={fadeUp}>
            <FiCpu aria-hidden="true" />
            AI-Powered Interview Plan
          </motion.div>
          <motion.h1 className={styles.title} variants={fadeUp}>
            Your Personalised Interview Plan
          </motion.h1>
          <motion.p className={styles.subtitle} variants={fadeUp}>
            Powered by IBM watsonx.ai — tailored to your profile and target role.
          </motion.p>
        </motion.div>

        {/* Plan grid — 4 key metrics */}
        <motion.div
          className={styles.planGrid}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className={styles.planCard} variants={fadeUp}>
            <div className={styles.planIconWrap}><FiTarget /></div>
            <div>
              <div className={styles.planLabel}>Candidate Level</div>
              <div className={styles.planValue}>{analysis.candidateLevel}</div>
              <div className={styles.planSub}>Determined from your full profile</div>
            </div>
          </motion.div>

          <motion.div className={styles.planCard} variants={fadeUp}>
            <div className={styles.planIconWrap}><FiLayers /></div>
            <div>
              <div className={styles.planLabel}>Interview Difficulty</div>
              <div className={styles.planValue}>{analysis.difficulty}</div>
              <div className={styles.planSub}>Calibrated to your experience</div>
            </div>
          </motion.div>

          <motion.div className={styles.planCard} variants={fadeUp}>
            <div className={styles.planIconWrap}><FiClock /></div>
            <div>
              <div className={styles.planLabel}>Estimated Duration</div>
              <div className={styles.planValue}>{estimatedDuration}</div>
              <div className={styles.planSub}>{totalQuestions} questions with coach feedback</div>
            </div>
          </motion.div>

          <motion.div className={styles.planCard} variants={fadeUp}>
            <div className={styles.planIconWrap}><FiMessageSquare /></div>
            <div>
              <div className={styles.planLabel}>Total Questions</div>
              <div className={styles.planValue}>{totalQuestions}</div>
              <div className={styles.planSub}>{MODE_LABEL[mode] ?? 'Mixed'} mode · AI tailored</div>
            </div>
          </motion.div>
        </motion.div>

        {/* AI summary */}
        <motion.div
          className={styles.summaryBox}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <h2 className={styles.summaryTitle}>
            <FiCpu aria-hidden="true" /> AI Interview Assessment
          </h2>
          <p className={styles.summaryText}>
            The AI has identified your key strengths as <strong>{analysis.strengths.slice(0, 2).join(' and ')}</strong>.
            The interview will probe your <strong>{analysis.focusTopics.slice(0, 3).join(', ')}</strong> — areas
            selected specifically for your target role. Expect {analysis.difficulty.toLowerCase()}-level questions
            designed to give you the best preparation experience at the <strong>{analysis.candidateLevel}</strong> tier.
          </p>
        </motion.div>

        {/* Question-type breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <h2 className={styles.breakdownTitle}>Question Breakdown</h2>
          <div className={styles.breakdownList}>
            {breakdown.map(({ label, count, color }) => (
              <div key={label} className={styles.breakdownItem}>
                <div className={styles.breakdownLabel}>
                  <span className={styles.breakdownDot} style={{ background: color }} />
                  {label}
                </div>
                <span className={styles.breakdownCount}>{count} question{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className={styles.actions}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <Button
            variant="primary"
            size="md"
            icon={<FiArrowRight />}
            onClick={() => navigate('/interview/mode', { state: { analysis, jdMatch } })}
          >
            Choose Interview Mode
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={<FiArrowLeft />}
            onClick={() => navigate('/profile')}
          >
            Back to Profile
          </Button>
        </motion.div>

      </div>
    </motion.div>
  );
}

/* ── No-profile guard ────────────────────────────────────────────────────────── */
function NoProfileGuard({ navigate }) {
  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <div style={{
          textAlign:       'center',
          maxWidth:        '480px',
          padding:         '48px 32px',
          background:      'rgba(255,255,255,0.04)',
          border:          '1px solid rgba(255,255,255,0.1)',
          borderRadius:    '16px',
          backdropFilter:  'blur(20px)',
        }}>
          <FiAlertCircle style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '20px' }} aria-hidden="true" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '12px' }}>
            No Profile Analysis Found
          </h2>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
            Complete your profile analysis before starting an interview.
          </p>
          <Button variant="primary" size="md" icon={<FiArrowRight />} onClick={() => navigate('/profile')}>
            Go to Profile
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default InterviewPlan;
