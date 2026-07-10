import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCpu, FiSend, FiArrowRight, FiCheckCircle,
  FiAlertCircle, FiStar, FiChevronRight,
} from 'react-icons/fi';
import { Button, Card, ProgressBar, Loader } from '../../components/index.js';
import { getInterviewState, setInterviewReport, setInterviewEvaluations, getInterviewReport } from '../../utils/storage.js';
import { apiFetch } from '../../utils/api.js';
import styles from './Interview.module.css';

const STATUS = { IDLE: 'idle', STARTING: 'starting', ASKING: 'asking', EVALUATING: 'evaluating', COACH_TIP: 'coach_tip', FINISHED: 'finished', ERROR: 'error' };

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function Interview() {
  const location  = useLocation();
  const navigate  = useNavigate();

  // Prefer analysis from router state, fall back to localStorage
  const savedState = getInterviewState() || {};
  const analysis  = location.state?.analysis ?? savedState.analysis;
  const mode      = location.state?.mode || 'mixed';

  const [status,        setStatus]        = useState(STATUS.IDLE);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [question,      setQuestion]      = useState('');
  const [answer,        setAnswer]        = useState('');
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [totalQuestions,setTotalQuestions]= useState(5);
  const [evaluation,    setEvaluation]    = useState(null);
  const [coachTip,      setCoachTip]      = useState('');

  const textareaRef = useRef(null);

  // Auto-start when the component mounts if we have an analysis
  useEffect(() => {
    if (!analysis) return; // guard handled by early return below
    startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus textarea after question loads
  useEffect(() => {
    if (status === STATUS.ASKING && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [status, question]);

  const startInterview = async () => {
    setStatus(STATUS.STARTING);
    setErrorMsg('');
    try {
      const res  = await apiFetch('/api/interview/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
      setQuestion(data.question);
      setCurrentIndex(1);
      setTotalQuestions(data.totalQuestions || 5);
      setStatus(STATUS.ASKING);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus(STATUS.ERROR);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setStatus(STATUS.EVALUATING);
    setErrorMsg('');
    try {
      const res  = await apiFetch('/api/interview/answer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ answer: answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);

      setEvaluation(data.evaluation);

      // Generate a coach tip from the evaluation feedback
      const tip = buildCoachTip(data.evaluation);
      setCoachTip(tip);
      setStatus(STATUS.COACH_TIP);

      if (data.finished) {
        // Merge the profile analysis into the report so FinalReport can re-use it
        const reportWithAnalysis = { ...data.report, analysis };
        setInterviewReport(reportWithAnalysis);
        setInterviewEvaluations(data.report?.evaluations || []);
      } else {
        sessionStorage.setItem('nextQuestion',    data.question);
        sessionStorage.setItem('nextQuestionIdx', data.questionIndex);
        sessionStorage.setItem('totalQuestions',  data.totalQuestions);
      }
    } catch (err) {
      setErrorMsg(err.message);
      setStatus(STATUS.ERROR);
    }
  };

  const proceedAfterTip = () => {
    const storedReport = getInterviewReport();
    if (storedReport) {
      navigate('/report');
      return;
    }
    const nextQ   = sessionStorage.getItem('nextQuestion');
    const nextIdx = sessionStorage.getItem('nextQuestionIdx');
    const total   = sessionStorage.getItem('totalQuestions');
    setQuestion(nextQ || '');
    setCurrentIndex(Number(nextIdx) || currentIndex + 1);
    setTotalQuestions(Number(total)  || totalQuestions);
    setAnswer('');
    setEvaluation(null);
    setCoachTip('');
    setStatus(STATUS.ASKING);
    sessionStorage.removeItem('nextQuestion');
    sessionStorage.removeItem('nextQuestionIdx');
    sessionStorage.removeItem('totalQuestions');
  };

  /** Build a short coaching tip from the evaluation object */
  const buildCoachTip = (ev) => {
    if (!ev) return '';
    const weaknesses = ev.weaknesses?.slice(0, 1)[0] || '';
    const topics     = ev.learningTopics?.slice(0, 1)[0] || '';
    if (weaknesses && topics) {
      return `To strengthen your answer: address "${weaknesses}". Spend some time reviewing ${topics} before your actual interview.`;
    }
    if (ev.feedback) return ev.feedback;
    return 'Good attempt! Focus on structuring your answer with a clear beginning, middle, and conclusion next time.';
  };

  const isFinishedAfterTip = () => !!getInterviewReport();

  // Show friendly guard if no analysis is available
  if (!analysis && status === STATUS.IDLE) {
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

  /* ── Score colour helper ───── */
  const scoreColor = (s) => s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

  /* ── Render ────────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className={`${styles.page} page-wrapper`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`${styles.inner} container`}>

        {/* Progress bar */}
        <div className={styles.progressWrapper}>
          <ProgressBar
            value={totalQuestions ? Math.round((currentIndex - 1) / totalQuestions * 100) : 0}
            label={status === STATUS.STARTING
              ? 'Starting interview…'
              : `Question ${currentIndex} of ${totalQuestions}`}
          />
        </div>

        {/* Mode badge */}
        <div className={styles.modeBadge}>
          <FiCpu aria-hidden="true" />
          {modeLabelMap[mode] || 'Mixed'} Interview Mode
        </div>

        {/* ── STARTING ──── */}
        <AnimatePresence mode="wait">
          {status === STATUS.STARTING && (
            <motion.div key="starting" className={styles.centeredState} variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <Loader size="lg" label="IBM Granite is generating your first question…" />
            </motion.div>
          )}

          {/* ── ASKING ──── */}
          {status === STATUS.ASKING && (
            <motion.div key="asking" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <Card animate={false} className={styles.questionCard}>
                <div className={styles.questionHeader}>
                  <span className={styles.qBadge}>Q{currentIndex}</span>
                  <span className={styles.qMode}>{modeLabelMap[mode] || 'Mixed'}</span>
                </div>
                <p className={styles.questionText}>{question}</p>
              </Card>

              <div className={styles.answerGroup}>
                <label htmlFor="answer" className={styles.answerLabel}>Your Answer</label>
                <textarea
                  ref={textareaRef}
                  id="answer"
                  className={styles.answerTextarea}
                  placeholder="Type your answer here… Take your time and be as detailed as you can."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={7}
                />
              </div>

              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="md"
                  icon={<FiSend />}
                  disabled={!answer.trim()}
                  onClick={submitAnswer}
                >
                  Submit Answer
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── EVALUATING ──── */}
          {status === STATUS.EVALUATING && (
            <motion.div key="evaluating" className={styles.centeredState} variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <Loader size="lg" label="IBM Granite is evaluating your answer…" />
            </motion.div>
          )}

          {/* ── COACH TIP ──── */}
          {status === STATUS.COACH_TIP && evaluation && (
            <motion.div key="coachtip" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>

              {/* Scores */}
              <div className={styles.scoreRow}>
                <ScorePill label="Overall"       score={evaluation.overallScore}        color={scoreColor(evaluation.overallScore)} />
                <ScorePill label="Technical"     score={evaluation.technicalScore}      color={scoreColor(evaluation.technicalScore)} />
                <ScorePill label="Communication" score={evaluation.communicationScore}  color={scoreColor(evaluation.communicationScore)} />
              </div>

              {/* AI Coach Tip */}
              <motion.div
                className={styles.coachTipBox}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
              >
                <div className={styles.coachTipHeader}>
                  <FiStar className={styles.coachTipIcon} aria-hidden="true" />
                  <span>AI Coach Tip</span>
                </div>
                <p className={styles.coachTipText}>{coachTip}</p>
              </motion.div>

              {/* Strengths / Weaknesses */}
              <div className={styles.evalGrid}>
                {evaluation.strengths?.length > 0 && (
                  <EvalList
                    title="What you did well"
                    items={evaluation.strengths}
                    icon={<FiCheckCircle />}
                    variant="strength"
                  />
                )}
                {evaluation.weaknesses?.length > 0 && (
                  <EvalList
                    title="Areas to improve"
                    items={evaluation.weaknesses}
                    icon={<FiAlertCircle />}
                    variant="weakness"
                  />
                )}
              </div>

              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="md"
                  icon={isFinishedAfterTip() ? <FiArrowRight /> : <FiChevronRight />}
                  onClick={proceedAfterTip}
                >
                  {isFinishedAfterTip() ? 'View Final Report' : 'Next Question'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ──── */}
          {status === STATUS.ERROR && (
            <motion.div key="error" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <div className={styles.errorBanner} role="alert">
                <FiAlertCircle aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" size="md" onClick={startInterview}>
                  Retry
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}

/* ── Interview mode labels ──────────────────────────────────────────────────── */
const modeLabelMap = {
  hr:         'HR',
  technical:  'Technical',
  dsa:        'DSA',
  behavioral: 'Behavioral',
  mixed:      'Mixed',
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function ScorePill({ label, score, color }) {
  return (
    <div className={styles.scorePill}>
      <span className={styles.scorePillLabel}>{label}</span>
      <span className={styles.scorePillValue} style={{ color }}>{score}<span className={styles.scorePillMax}>/100</span></span>
    </div>
  );
}

function EvalList({ title, items, icon, variant }) {
  return (
    <div className={`${styles.evalList} ${styles['eval_' + variant]}`}>
      <h3 className={styles.evalListTitle}>
        <span className={styles.evalListIcon}>{icon}</span>
        {title}
      </h3>
      <ul className={styles.evalItems}>
        {items.map((item, i) => (
          <li key={i} className={styles.evalItem}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default Interview;
