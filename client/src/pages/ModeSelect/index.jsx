import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiCode, FiLayers, FiBriefcase, FiAward,
  FiCheckCircle, FiArrowRight, FiArrowLeft, FiFileText, FiAlertCircle,
} from 'react-icons/fi';
import { Button } from '../../components/index.js';
import { getInterviewState } from '../../utils/storage.js';
import styles from './ModeSelect.module.css';

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const MODES = [
  {
    id:    'hr',
    icon:  <FiUsers />,
    title: 'HR',
    desc:  'Explore motivation, culture fit, career goals, and team dynamics. Best for freshers and anyone preparing for initial recruiter screens.',
    tags:  ['Motivation', 'Culture', 'Goals'],
    color: '#3b82f6',
  },
  {
    id:    'technical',
    icon:  <FiCode />,
    title: 'Technical',
    desc:  'Deep dives into your stack, system design, architecture decisions, and technical problem-solving skills.',
    tags:  ['System Design', 'Architecture', 'Stack'],
    color: '#8b5cf6',
  },
  {
    id:    'dsa',
    icon:  <FiLayers />,
    title: 'DSA',
    desc:  'Data structures, algorithms, time/space complexity, and coding problem-solving. Ideal for software engineering roles.',
    tags:  ['Algorithms', 'Data Structures', 'Coding'],
    color: '#06b6d4',
  },
  {
    id:    'behavioral',
    icon:  <FiBriefcase />,
    title: 'Behavioral',
    desc:  'STAR-format situational and competency questions probing leadership, conflict resolution, and collaboration.',
    tags:  ['STAR Method', 'Leadership', 'Teamwork'],
    color: '#10b981',
  },
  {
    id:    'mixed',
    icon:  <FiAward />,
    title: 'Mixed',
    desc:  'AI-recommended blend of all question types, calibrated to your profile and target role for a comprehensive practice experience.',
    tags:  ['HR', 'Technical', 'Behavioral'],
    color: '#f59e0b',
    recommended: true,
  },
  {
    id:      'job_specific',
    icon:    <FiFileText />,
    title:   'Job-Specific',
    desc:    'Eight targeted questions focused on the exact technologies, responsibilities and skills from the Job Description you provided.',
    tags:    ['JD-Focused', '8 Questions', 'Targeted'],
    color:   '#ec4899',
    needsJd: true,
  },
];

function ModeSelect() {
  const location = useLocation();
  const navigate  = useNavigate();

  // Prefer router state, fall back to localStorage
  const savedState = getInterviewState() || {};
  const analysis = location.state?.analysis ?? savedState.analysis;
  const jdMatch  = location.state?.jdMatch  ?? savedState.jdMatch;
  const hasJd    = !!(jdMatch?.skillMatchPercent !== undefined);
  const [selected, setSelected] = useState('mixed');

  if (!analysis) {
    return <NoProfileGuard navigate={navigate} />;
  }

  const handleContinue = () => {
    navigate('/interview', { state: { analysis, mode: selected, jdMatch } });
  };

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
          <motion.span className={styles.label} variants={fadeUp}>Step 3 of 5</motion.span>
          <motion.h1 className={styles.title} variants={fadeUp}>Choose Your Interview Mode</motion.h1>
          <motion.p className={styles.subtitle} variants={fadeUp}>
            Select the type of interview you want to practice. The AI will tailor every question to your chosen mode.
          </motion.p>
        </motion.div>

        {/* Mode cards */}
        <motion.div
          className={styles.modesGrid}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {MODES.map(({ id, icon, title, desc, tags, color, recommended, needsJd }) => {
            const isDisabled = needsJd && !hasJd;
            return (
            <motion.button
              key={id}
              className={`${styles.modeCard} ${selected === id ? styles.selected : ''} ${isDisabled ? styles.modeCardDisabled : ''}`}
              style={{ '--card-color': color, '--icon-bg': color + '1a' }}
              variants={fadeUp}
              whileHover={!isDisabled ? { y: -3, transition: { duration: 0.18 } } : {}}
              onClick={() => !isDisabled && setSelected(id)}
              aria-pressed={selected === id}
              aria-disabled={isDisabled}
            >
              {recommended && (
                <span className={styles.recommendedChip}>AI Recommended</span>
              )}
              {needsJd && !hasJd && (
                <span className={styles.requiresJdChip}>Paste a JD to unlock</span>
              )}
              {needsJd && hasJd && (
                <span className={styles.jdReadyChip}>JD Loaded ✓</span>
              )}
              <AnimatePresence>
                {selected === id && (
                  <motion.span
                    className={styles.selectedBadge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FiCheckCircle />
                  </motion.span>
                )}
              </AnimatePresence>

              <div className={styles.modeIconWrap}>{icon}</div>
              <h3 className={styles.modeCardTitle}>{title}</h3>
              <p  className={styles.modeCardDesc}>{desc}</p>
              <div className={styles.modeTagRow}>
                {tags.map((t) => <span key={t} className={styles.modeTag}>{t}</span>)}
              </div>
            </motion.button>
            );
          })}
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
            onClick={handleContinue}
          >
            Start Interview
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={<FiArrowLeft />}
            onClick={() => navigate('/interview/plan', { state: { analysis } })}
          >
            Back to Plan
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

export default ModeSelect;
