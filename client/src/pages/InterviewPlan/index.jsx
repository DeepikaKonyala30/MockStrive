import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiCheckCircle, FiTarget, FiClock, FiLayers,
  FiMessageSquare, FiCode, FiUsers, FiBriefcase,
  FiArrowRight, FiArrowLeft, FiCpu, FiAlertCircle,
} from 'react-icons/fi';
import { Button } from '../../components/index.js';
import { getInterviewState } from '../../utils/storage.js';
import styles from './InterviewPlan.module.css';

/* Maps difficulty to approximate duration */
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const DURATION_MAP = { Easy: '15–20 min', Medium: '20–30 min', Hard: '30–40 min' };

/* Question-type breakdown (total 5 questions) */
const BREAKDOWN_MAP = {
  Easy:   [{ label: 'HR / Intro',   count: 2, color: '#3b82f6' }, { label: 'Technical',  count: 2, color: '#8b5cf6' }, { label: 'Behavioral', count: 1, color: '#10b981' }],
  Medium: [{ label: 'HR / Intro',   count: 1, color: '#3b82f6' }, { label: 'Technical',  count: 3, color: '#8b5cf6' }, { label: 'Behavioral', count: 1, color: '#10b981' }],
  Hard:   [{ label: 'Technical',    count: 3, color: '#8b5cf6' }, { label: 'Behavioral', count: 1, color: '#10b981' }, { label: 'DSA / System Design', count: 1, color: '#06b6d4' }],
};


function InterviewPlan() {
  const location = useLocation();
  const navigate = useNavigate();

  // Prefer analysis from router state (just came from profile page),
  // fall back to localStorage (direct navigation / page refresh)
  const savedState = getInterviewState() || {};
  const [analysis, setAnalysis] = useState(
    () => location.state?.analysis ?? savedState.analysis
  );
  const [jdMatch, setJdMatch] = useState(
    () => location.state?.jdMatch ?? savedState.jdMatch
  );

  // If neither source yields an analysis, show the no-profile guard
  if (!analysis) {
    return <NoProfileGuard navigate={navigate} />;
  }

  const duration  = DURATION_MAP[analysis.difficulty]  || '20–30 min';
  const breakdown = BREAKDOWN_MAP[analysis.difficulty] || BREAKDOWN_MAP.Medium;

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
            IBM Granite Interview Plan
          </motion.div>
          <motion.h1 className={styles.title} variants={fadeUp}>
            Your Personalised Interview Plan
          </motion.h1>
          <motion.p className={styles.subtitle} variants={fadeUp}>
            Based on your profile, IBM Granite has designed the following interview experience.
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
              <div className={styles.planValue}>{duration}</div>
              <div className={styles.planSub}>5 questions with coach feedback</div>
            </div>
          </motion.div>

          <motion.div className={styles.planCard} variants={fadeUp}>
            <div className={styles.planIconWrap}><FiMessageSquare /></div>
            <div>
              <div className={styles.planLabel}>Total Questions</div>
              <div className={styles.planValue}>5</div>
              <div className={styles.planSub}>Mixed categories tailored for you</div>
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
            <FiCpu aria-hidden="true" /> Coach Assessment
          </h2>
          <p className={styles.summaryText}>
            IBM Granite has identified your key strengths as <strong>{analysis.strengths.slice(0, 2).join(' and ')}</strong>.
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
