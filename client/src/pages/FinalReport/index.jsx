import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiAward, FiCode, FiMessageSquare,
  FiCheckCircle, FiAlertCircle, FiBookOpen, FiLayers,
  FiMap, FiCpu, FiArrowRight, FiRefreshCw, FiSliders, FiUser,
  FiPercent, FiTrendingUp, FiZap,
} from 'react-icons/fi';
import { Button } from '../../components/index.js';
import { getInterviewState, getInterviewReport } from '../../utils/storage.js';
import styles from './FinalReport.module.css';

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function FinalReport() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);

  useEffect(() => {
    const r = getInterviewReport();
    if (r) setReport(r);
  }, []);

  const scoreColor = (s) => {
    if (s === undefined || s === null) return 'var(--color-text-muted)';
    return s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';
  };

  const scoreLabel = (s) => {
    if (s === undefined || s === null) return '–';
    return s >= 75 ? 'Strong' : s >= 50 ? 'Developing' : 'Needs Work';
  };

  const hasReport = !!report;

  return (
    <motion.div
      className={`${styles.page} page-wrapper`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container">

        {/* ── HEADER ───── */}
        <motion.div
          className={styles.header}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className={styles.headerLeft} variants={fadeUp}>
            <div className={styles.headerBadge}>
              <FiCpu aria-hidden="true" /> AI Coach Report
            </div>
            <h1 className={styles.title}>
              {hasReport && report.candidateName
                ? `${report.candidateName}'s Interview Report`
                : 'Interview Report'}
            </h1>
            {hasReport && (
              <p className={styles.subtitle}>
                {report.targetRole} · {report.candidateLevel}
              </p>
            )}
          </motion.div>
          <motion.div className={styles.headerRight} variants={fadeUp}>
            <Button
              variant="ghost"
              size="sm"
              icon={<FiRefreshCw />}
              onClick={() => {
                const storedState = getInterviewState() || {};
                const storedAnalysis = report?.analysis ?? storedState.analysis;
                if (storedAnalysis) {
                  navigate('/interview/plan', { state: { analysis: storedAnalysis } });
                } else {
                  navigate('/profile');
                }
              }}
            >
              New Interview
            </Button>
          </motion.div>
        </motion.div>

        {hasReport ? (
          <>
            {/* ── JD SKILL MATCH (shown only when jdMatch is present) ───── */}
            {report.jdMatch && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FiPercent aria-hidden="true" /> Job Description Match
                </h2>
                <JdMatchPanel jdMatch={report.jdMatch} />
              </section>
            )}

            {/* ── INTERVIEW SUMMARY ───── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FiLayers aria-hidden="true" /> Interview Summary
              </h2>
              <div className={styles.summaryBox}>
                <p className={styles.summaryText}>{report.summary}</p>
              </div>
            </section>

            {/* ── SCORE OVERVIEW ───── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FiAward aria-hidden="true" /> Score Overview
              </h2>
              <motion.div
                className={styles.scoreGrid}
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <ScoreCard
                  icon={<FiAward />}
                  label="Overall Score"
                  score={report.overallScore}
                  scoreLabel={scoreLabel(report.overallScore)}
                  color={scoreColor(report.overallScore)}
                />
                <ScoreCard
                  icon={<FiCode />}
                  label="Technical Score"
                  score={report.technicalScore}
                  scoreLabel={scoreLabel(report.technicalScore)}
                  color={scoreColor(report.technicalScore)}
                />
                <ScoreCard
                  icon={<FiMessageSquare />}
                  label="Communication Score"
                  score={report.communicationScore}
                  scoreLabel={scoreLabel(report.communicationScore)}
                  color={scoreColor(report.communicationScore)}
                />
              </motion.div>
            </section>

            {/* ── STRENGTHS & IMPROVEMENT ───── */}
            <section className={styles.section}>
              <div className={styles.twoCol}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <FiCheckCircle aria-hidden="true" /> Strengths
                  </h2>
                  <ul className={`${styles.tagList} ${styles.tagListStrength}`}>
                    {report.strengths?.map((s, i) => (
                      <motion.li
                        key={i}
                        className={`${styles.tag} ${styles.tagStrength}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        viewport={{ once: true }}
                      >
                        <FiCheckCircle aria-hidden="true" /> {s}
                      </motion.li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <FiAlertCircle aria-hidden="true" /> Improvement Areas
                  </h2>
                  <ul className={`${styles.tagList} ${styles.tagListWeak}`}>
                    {report.weaknesses?.map((w, i) => (
                      <motion.li
                        key={i}
                        className={`${styles.tag} ${styles.tagWeak}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        viewport={{ once: true }}
                      >
                        <FiAlertCircle aria-hidden="true" /> {w}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* ── QUESTION-WISE FEEDBACK ───── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FiMessageSquare aria-hidden="true" /> Question-wise Feedback
              </h2>
              <div className={styles.qFeedbackList}>
                {report.evaluations?.map((ev, i) => (
                  <motion.div
                    key={i}
                    className={styles.qFeedbackCard}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <div className={styles.qFeedbackHeader}>
                      <span className={styles.qNum}>Q{i + 1}</span>
                      <div className={styles.qScorePills}>
                        <span style={{ color: scoreColor(ev.overallScore) }} className={styles.qScorePill}>
                          {ev.overallScore}/100
                        </span>
                      </div>
                    </div>
                    <p className={styles.qText}>{ev.question}</p>
                    <p className={styles.qFeedbackText}>{ev.feedback}</p>

                    {ev.strengths?.length > 0 && (
                      <div className={styles.qMiniSection}>
                        <span className={styles.qMiniLabel}>Well done:</span>
                        <span className={styles.qMiniItems}>{ev.strengths.join(' · ')}</span>
                      </div>
                    )}
                    {ev.weaknesses?.length > 0 && (
                      <div className={styles.qMiniSection}>
                        <span className={`${styles.qMiniLabel} ${styles.qMiniLabelWeak}`}>Improve:</span>
                        <span className={styles.qMiniItems}>{ev.weaknesses.join(' · ')}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── LEARNING ROADMAP ───── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FiMap aria-hidden="true" /> Personalised Learning Roadmap
              </h2>
              <div className={styles.roadmapGrid}>
                {report.learningTopics?.map((topic, i) => (
                  <motion.div
                    key={i}
                    className={styles.roadmapItem}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    viewport={{ once: true }}
                  >
                    <div className={styles.roadmapStep}>{String(i + 1).padStart(2, '0')}</div>
                    <div>
                      <p className={styles.roadmapTopic}>{topic}</p>
                      <p className={styles.roadmapHint}>Study this before your next interview</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── FINAL AI COACH RECOMMENDATION ───── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FiCpu aria-hidden="true" /> Final AI Coach Recommendation
              </h2>
              <motion.div
                className={styles.recommendationBox}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <p className={styles.recommendationText}>
                  {buildRecommendation(report)}
                </p>
              </motion.div>
            </section>

            {/* ── ACTIONS ───── */}
            <div className={styles.finalActions}>
              <Button
                variant="primary"
                size="md"
                icon={<FiArrowRight />}
                onClick={() => {
                  const storedState = getInterviewState() || {};
                  const storedAnalysis = report?.analysis ?? storedState.analysis;
                  if (storedAnalysis) {
                    navigate('/interview/plan', { state: { analysis: storedAnalysis } });
                  } else {
                    navigate('/profile');
                  }
                }}
              >
                Take Another Interview
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<FiSliders />}
                onClick={() => {
                  const storedState = getInterviewState() || {};
                  const storedAnalysis = report?.analysis ?? storedState.analysis;
                  if (storedAnalysis) {
                    navigate('/interview/mode', { state: { analysis: storedAnalysis } });
                  } else {
                    navigate('/profile');
                  }
                }}
              >
                Change Interview Type
              </Button>
              <Button
                variant="ghost"
                size="md"
                icon={<FiUser />}
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className={styles.emptyState}>
            <FiBookOpen className={styles.emptyIcon} aria-hidden="true" />
            <h2 className={styles.emptyTitle}>No Interview Data Yet</h2>
            <p className={styles.emptyText}>
              Complete an interview to see your full AI Coach Report, question-wise feedback,
              and personalised learning roadmap.
            </p>
            <Button variant="primary" size="md" icon={<FiArrowRight />} onClick={() => navigate('/profile')}>
              Start Coaching
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function buildRecommendation(report) {
  if (!report) return '';
  const overall = report.overallScore ?? 50;
  const level   = report.candidateLevel || 'this level';
  const role    = report.targetRole     || 'the role';

  if (overall >= 80) {
    return `Outstanding performance for a ${level} candidate targeting ${role}. Your answers demonstrated strong depth and clarity. Focus on the learning roadmap above to close your remaining gaps and you'll be a compelling candidate.`;
  }
  if (overall >= 60) {
    return `Solid performance overall. You demonstrated good foundations for ${role}, but there are specific areas to strengthen before your actual interview. Work through the learning roadmap systematically — even 2–3 hours per topic will make a meaningful difference.`;
  }
  return `This interview has highlighted clear areas to develop for ${role} at the ${level} level. Do not be discouraged — use this report as your starting point. Work through the roadmap topics in order, and retake the interview after each study session to track your progress.`;
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function ScoreCard({ icon, label, score, scoreLabel, color }) {
  return (
    <motion.div className={styles.scoreCard} variants={fadeUp}>
      <div className={styles.scoreCardIcon}>{icon}</div>
      <div className={styles.scoreCardLabel}>{label}</div>
      <div className={styles.scoreCardValue} style={{ color }}>
        {score !== undefined ? score : '–'}
        <span className={styles.scoreCardMax}>/100</span>
      </div>
      <div className={styles.scoreCardBadge} style={{ borderColor: color, color }}>
        {scoreLabel}
      </div>
    </motion.div>
  );
}

function readinessColor(r) {
  if (r === 'Highly Ready')    return '#10b981';
  if (r === 'Ready')           return '#3b82f6';
  if (r === 'Partially Ready') return '#f59e0b';
  return '#ef4444';
}

function JdMatchPanel({ jdMatch }) {
  const rc = readinessColor(jdMatch.interviewReadiness);
  return (
    <div className={styles.jdPanel}>
      {/* Top row: readiness badge + match % */}
      <div className={styles.jdPanelTop}>
        <div className={styles.jdReadinessBlock}>
          <span className={styles.jdReadinessLabel}>Interview Readiness</span>
          <span className={styles.jdReadinessBadge} style={{ borderColor: rc, color: rc }}>
            {jdMatch.interviewReadiness}
          </span>
        </div>
        <div className={styles.jdMatchPctBlock}>
          <span className={styles.jdMatchPctNum} style={{ color: rc }}>{jdMatch.skillMatchPercent}%</span>
          <span className={styles.jdMatchPctLabel}>Skill Match</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.jdBarTrack}>
        <motion.div
          className={styles.jdBarFill}
          style={{ background: rc }}
          initial={{ width: 0 }}
          whileInView={{ width: `${jdMatch.skillMatchPercent}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Skills two-col */}
      <div className={styles.jdSkillCols}>
        {jdMatch.keyStrengths?.length > 0 && (
          <div>
            <div className={styles.jdColTitle}>
              <FiCheckCircle aria-hidden="true" style={{ color: '#6ee7b7' }} /> Key Strengths
            </div>
            <ul className={styles.jdTagList}>
              {jdMatch.keyStrengths.map((s, i) => (
                <li key={i} className={`${styles.jdTag} ${styles.jdTagMatch}`}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {jdMatch.skillGaps?.length > 0 && (
          <div>
            <div className={styles.jdColTitle}>
              <FiAlertCircle aria-hidden="true" style={{ color: '#fca5a5' }} /> Skill Gaps
            </div>
            <ul className={styles.jdTagList}>
              {jdMatch.skillGaps.map((s, i) => (
                <li key={i} className={`${styles.jdTag} ${styles.jdTagMissing}`}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Technologies to improve */}
      {jdMatch.technologiesToImprove?.length > 0 && (
        <div className={styles.jdTechSection}>
          <div className={styles.jdColTitle}>
            <FiTrendingUp aria-hidden="true" style={{ color: '#f59e0b' }} /> Technologies to Improve
          </div>
          <div className={styles.jdTechTags}>
            {jdMatch.technologiesToImprove.map((t, i) => (
              <span key={i} className={styles.jdTechTag}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FinalReport;
