import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiBriefcase, FiClock, FiBookOpen,
  FiCode, FiFileText, FiCheckCircle, FiAlertCircle,
  FiTarget, FiArrowRight, FiSave,
  FiZap, FiPercent, FiList, FiTrendingUp,
} from 'react-icons/fi';
import { Button, Card, Loader } from '../../components/index.js';
import { getInterviewState, updateInterviewState, clearInterviewState } from '../../utils/storage.js';
import { apiFetch } from '../../utils/api.js';
import styles from './CandidateProfile.module.css';

const INITIAL = {
  fullName:        '',
  targetRole:      '',
  experienceLevel: '',
  education:       '',
  skills:          '',
  resumeSummary:   '',
};

const STATUS = { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' };

// ─── Readiness colour ─────────────────────────────────────────────────────────
function readinessColor(r) {
  if (r === 'Highly Ready') return '#10b981';
  if (r === 'Ready')        return '#3b82f6';
  if (r === 'Partially Ready') return '#f59e0b';
  return '#ef4444';
}

function CandidateProfile() {
  const savedState = getInterviewState() || {};
  const savedProfile = savedState.profile;
  const savedAnalysis = savedState.analysis;
  const savedJdMatch = savedState.jdMatch;
  const savedJdText = savedState.jdText || '';

  const [form,     setForm]     = useState(savedProfile ?? INITIAL);
  const [hasSaved, setHasSaved] = useState(!!savedProfile);
  const [status,   setStatus]   = useState(savedAnalysis ? STATUS.SUCCESS : STATUS.IDLE);
  const [analysis, setAnalysis] = useState(savedAnalysis);
  const [errorMsg, setErrorMsg] = useState('');

  const [jdText,      setJdText]      = useState(savedJdText);
  const [jdAnalyzing, setJdAnalyzing] = useState(false);
  const [jdMatch,     setJdMatch]     = useState(savedJdMatch);
  const [jdError,     setJdError]     = useState('');

  const navigate = useNavigate();

  // Persist form fields
  useEffect(() => {
    const filled = Object.values(form).some((v) => v.trim?.() !== '');
    if (filled) updateInterviewState({ profile: form });
  }, [form]);

  // Persist JD text
  useEffect(() => {
    updateInterviewState({ jdText });
  }, [jdText]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (status === STATUS.ERROR) setStatus(STATUS.IDLE);
  };

  const handleReset = () => {
    clearInterviewState();
    setForm(INITIAL);
    setHasSaved(false);
    setAnalysis(null);
    setStatus(STATUS.IDLE);
    setErrorMsg('');
    setJdText('');
    setJdMatch(null);
    setJdError('');
  };

  // ── JD analysis ───────────────────────────────────────────────────────────
  const handleJdAnalyze = async () => {
    if (!jdText.trim()) return;
    setJdAnalyzing(true);
    setJdError('');
    setJdMatch(null);

    try {
      const res  = await apiFetch('/api/prep/jd/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'JD analysis failed');
      setJdMatch(data.jdMatch);
      updateInterviewState({ jdMatch: data.jdMatch });
    } catch (err) {
      setJdError(err.message || 'JD analysis failed');
    } finally {
      setJdAnalyzing(false);
    }
  };

  // ── Profile submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(STATUS.LOADING);
    setErrorMsg('');
    setAnalysis(null);

    try {
      const res = await apiFetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error
          ? `${data.error}${data.fields ? ': ' + data.fields.join(', ') : ''}`
          : `Server error (${res.status})`;
        throw new Error(msg);
      }

      // Persist profile + analysis so they survive page refresh
      updateInterviewState({ profile: form, analysis: data.analysis });
      setHasSaved(true);
      setAnalysis(data.analysis);
      setStatus(STATUS.SUCCESS);
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setStatus(STATUS.ERROR);
    }
  };

  const isLoading = status === STATUS.LOADING;

  return (
    <motion.div
      className={`${styles.page} page-wrapper`}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Candidate Profile</h1>
          <p className={styles.subtitle}>
            Tell us about yourself so the AI can tailor your interview experience.
          </p>
        </div>

        <div className={styles.layout}>
          {/* ── Saved profile banner ──────────────────────────────────────── */}
          <AnimatePresence>
            {hasSaved && status !== STATUS.SUCCESS && (
              <motion.div
                className={styles.savedBanner}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className={styles.savedBannerText}>
                  <FiSave aria-hidden="true" />
                  Profile restored from your last session — edit freely or reset.
                </span>
                <button type="button" className={styles.resetBtn} onClick={handleReset}>
                  Reset Profile
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Profile Form card ─────────────────────────────────────────── */}
          <div className={styles.formCard}>
            <form onSubmit={handleSubmit} className={styles.form} noValidate>

              {/* Full Name */}
              <div className={styles.fieldGroup}>
                <label htmlFor="fullName" className={styles.label}>
                  <FiUser className={styles.labelIcon} aria-hidden="true" />
                  Full Name
                </label>
                <input
                  id="fullName" name="fullName" type="text"
                  className={styles.input}
                  placeholder="e.g. Jane Smith"
                  value={form.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                  disabled={isLoading}
                />
              </div>

              {/* Target Role */}
              <div className={styles.fieldGroup}>
                <label htmlFor="targetRole" className={styles.label}>
                  <FiBriefcase className={styles.labelIcon} aria-hidden="true" />
                  Target Role
                </label>
                <input
                  id="targetRole" name="targetRole" type="text"
                  className={styles.input}
                  placeholder="e.g. Senior Software Engineer"
                  value={form.targetRole}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              {/* Experience Level */}
              <div className={styles.fieldGroup}>
                <label htmlFor="experienceLevel" className={styles.label}>
                  <FiClock className={styles.labelIcon} aria-hidden="true" />
                  Experience Level
                </label>
                <select
                  id="experienceLevel" name="experienceLevel"
                  className={styles.input}
                  value={form.experienceLevel}
                  onChange={handleChange}
                  disabled={isLoading}
                >
                  <option value="">Select your level…</option>
                  <option value="0–1 years (Intern / Entry-level)">0–1 years (Intern / Entry-level)</option>
                  <option value="2–3 years (Junior)">2–3 years (Junior)</option>
                  <option value="4–6 years (Mid-Level)">4–6 years (Mid-Level)</option>
                  <option value="7–10 years (Senior)">7–10 years (Senior)</option>
                  <option value="10+ years (Lead / Principal)">10+ years (Lead / Principal)</option>
                </select>
              </div>

              {/* Education */}
              <div className={styles.fieldGroup}>
                <label htmlFor="education" className={styles.label}>
                  <FiBookOpen className={styles.labelIcon} aria-hidden="true" />
                  Education
                </label>
                <input
                  id="education" name="education" type="text"
                  className={styles.input}
                  placeholder="e.g. BSc Computer Science, MIT"
                  value={form.education}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              {/* Skills */}
              <div className={styles.fieldGroup}>
                <label htmlFor="skills" className={styles.label}>
                  <FiCode className={styles.labelIcon} aria-hidden="true" />
                  Key Skills
                </label>
                <textarea
                  id="skills" name="skills"
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="e.g. React, Node.js, REST APIs, System Design, Python…"
                  value={form.skills}
                  onChange={handleChange}
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              {/* Resume Summary */}
              <div className={styles.fieldGroup}>
                <label htmlFor="resumeSummary" className={styles.label}>
                  <FiFileText className={styles.labelIcon} aria-hidden="true" />
                  Resume Summary
                </label>
                <textarea
                  id="resumeSummary" name="resumeSummary"
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="Paste a brief summary of your work history, key achievements, or notable projects…"
                  value={form.resumeSummary}
                  onChange={handleChange}
                  rows={5}
                  disabled={isLoading}
                />
              </div>

              {/* Error message */}
              <AnimatePresence>
                {status === STATUS.ERROR && (
                  <motion.div
                    className={styles.errorBanner}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                  >
                    <FiAlertCircle aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isLoading}
                  icon={isLoading ? null : <FiArrowRight />}
                >
                  {isLoading ? 'Analysing…' : status === STATUS.SUCCESS ? 'Re-Analyse Profile' : 'Analyse Profile'}
                </Button>
                {status === STATUS.SUCCESS && (
                  <button type="button" className={styles.resetBtn} onClick={handleReset}>
                    Reset Profile
                  </button>
                )}
                {isLoading && <Loader size="sm" label="Analysing your profile…" />}
              </div>
            </form>
          </div>

          {/* ── Analysis result card ──────────────────────────────────────── */}
          <AnimatePresence>
            {status === STATUS.SUCCESS && analysis && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className={styles.resultWrapper}
              >
                <Card animate={false} className={styles.resultCard}>
                  {/* Header row */}
                  <div className={styles.resultHeader}>
                    <div className={styles.successBadge}>
                      <FiCheckCircle aria-hidden="true" />
                      Profile Analysed
                    </div>
                    <div className={styles.metaBadges}>
                      <span className={`${styles.badge} ${styles.badgeLevel}`}>
                        {analysis.candidateLevel}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeDifficulty} ${styles['difficulty' + analysis.difficulty]}`}>
                        {analysis.difficulty} difficulty
                      </span>
                    </div>
                  </div>

                  <ResultSection icon={<FiCheckCircle />} title="Strengths"              items={analysis.strengths}   variant="strength" />
                  <ResultSection icon={<FiAlertCircle />} title="Weaknesses"             items={analysis.weaknesses}  variant="weakness" />
                  <ResultSection icon={<FiTarget />}      title="Interview Focus Topics" items={analysis.focusTopics} variant="focus"    />

                  <div className={styles.resultCta}>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate('/interview/plan', { state: { analysis, jdMatch } })}
                      icon={<FiArrowRight />}
                    >
                      View Interview Plan
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════════
              INTERVIEW PREPARATION SECTION — Job Description (optional)
              Shown below the profile form so users naturally fill their
              profile first before optionally enriching with a JD.
          ══════════════════════════════════════════════════════════════════ */}
          <div className={styles.prepCard}>
            <div className={styles.prepCardHeader}>
              <FiZap className={styles.prepCardIcon} aria-hidden="true" />
              <div>
                <h2 className={styles.prepCardTitle}>Interview Preparation</h2>
                <p className={styles.prepCardSubtitle}>
                  Paste a Job Description for a personalised skill-gap analysis.
                </p>
              </div>
            </div>

            {/* ── Job Description ────────────────────────────────────────── */}
            <div className={styles.prepSection}>
              <h3 className={styles.prepSectionTitle}>
                <FiFileText aria-hidden="true" /> Job Description
                <span className={styles.optionalBadge}>Optional</span>
              </h3>

              <textarea
                className={`${styles.input} ${styles.textarea} ${styles.jdTextarea}`}
                placeholder="Paste the full job description here. The AI will compare it with your profile to generate a skill-match report and unlock Job-Specific Interview mode…"
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  if (jdMatch) {
                    setJdMatch(null);
                    updateInterviewState({ jdMatch: null });
                  }
                  if (jdError) setJdError('');
                }}
                rows={7}
                disabled={jdAnalyzing || isLoading}
              />

              <div className={styles.prepActions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!jdText.trim() || jdAnalyzing || isLoading || !analysis}
                  onClick={handleJdAnalyze}
                  icon={jdAnalyzing ? null : <FiZap />}
                >
                  {jdAnalyzing ? 'Analysing…' : 'Analyse JD'}
                </Button>
                {jdText && (
                  <button
                    type="button"
                    className={styles.clearTextBtn}
                    onClick={() => {
                      setJdText('');
                      setJdMatch(null);
                      setJdError('');
                      updateInterviewState({ jdText: '', jdMatch: null });
                    }}
                  >
                    Clear
                  </button>
                )}
                {!analysis && jdText.trim() && (
                  <span className={styles.jdRequiresProfile}>
                    Analyse your profile first to enable JD analysis.
                  </span>
                )}
                {jdAnalyzing && <Loader size="sm" label="Analysing job description…" />}
              </div>

              {jdError && (
                <div className={styles.prepError} role="alert">
                  <FiAlertCircle aria-hidden="true" /> {jdError}
                </div>
              )}
            </div>

            {/* ── JD Match Result ────────────────────────────────────────── */}
            <AnimatePresence>
              {jdMatch && (
                <motion.div
                  className={styles.jdMatchPanel}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  {/* Headline row */}
                  <div className={styles.jdMatchHeader}>
                    <div className={styles.jdMatchTitle}>
                      <FiPercent aria-hidden="true" /> Skill Match Analysis
                    </div>
                    <div className={styles.jdMatchBadges}>
                      <span
                        className={styles.readinessBadge}
                        style={{ borderColor: readinessColor(jdMatch.interviewReadiness), color: readinessColor(jdMatch.interviewReadiness) }}
                      >
                        {jdMatch.interviewReadiness}
                      </span>
                    </div>
                  </div>

                  {/* Match percentage bar */}
                  <div className={styles.matchBarWrap}>
                    <div className={styles.matchBarLabel}>
                      <span>Skill Match</span>
                      <span className={styles.matchBarPct}>{jdMatch.skillMatchPercent}%</span>
                    </div>
                    <div className={styles.matchBarTrack}>
                      <motion.div
                        className={styles.matchBarFill}
                        style={{ background: readinessColor(jdMatch.interviewReadiness) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${jdMatch.skillMatchPercent}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Two-column skills */}
                  <div className={styles.jdMatchCols}>
                    {jdMatch.keyStrengths?.length > 0 && (
                      <div className={styles.jdMatchCol}>
                        <div className={styles.jdMatchColTitle}>
                          <FiCheckCircle aria-hidden="true" style={{ color: '#6ee7b7' }} />
                          Key Strengths
                        </div>
                        <ul className={styles.skillTagList}>
                          {jdMatch.keyStrengths.map((s, i) => (
                            <li key={i} className={`${styles.skillTag} ${styles.skillTagMatch}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {jdMatch.skillGaps?.length > 0 && (
                      <div className={styles.jdMatchCol}>
                        <div className={styles.jdMatchColTitle}>
                          <FiAlertCircle aria-hidden="true" style={{ color: '#fca5a5' }} />
                          Skill Gaps
                        </div>
                        <ul className={styles.skillTagList}>
                          {jdMatch.skillGaps.map((s, i) => (
                            <li key={i} className={`${styles.skillTag} ${styles.skillTagMissing}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {jdMatch.technologiesToImprove?.length > 0 && (
                    <div className={styles.jdTechRow}>
                      <div className={styles.jdMatchColTitle}>
                        <FiTrendingUp aria-hidden="true" style={{ color: '#f59e0b' }} />
                        Technologies to Improve
                      </div>
                      <div className={styles.techTagWrap}>
                        {jdMatch.technologiesToImprove.map((t, i) => (
                          <span key={i} className={styles.techTag}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className={styles.jdMatchNote}>
                    <FiList aria-hidden="true" />
                    Job-Specific Interview mode is now available in the interview setup — it will ask 8 questions focused on the technologies and responsibilities in this JD.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

function ResultSection({ icon, title, items, variant }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`${styles.resultSection} ${styles['section_' + variant]}`}>
      <h3 className={styles.resultSectionTitle}>
        <span className={styles.resultSectionIcon} aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <ul className={styles.resultList}>
        {items.map((item, i) => (
          <li key={i} className={styles.resultListItem}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default CandidateProfile;
