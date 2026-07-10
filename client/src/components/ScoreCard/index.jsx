import { motion } from 'framer-motion';
import styles from './ScoreCard.module.css';

/**
 * ScoreCard — used on the Final Report page for evaluation metrics
 * @param {string}            label
 * @param {string|number}     value
 * @param {React.ReactNode}   icon     — react-icons element
 * @param {('metric'|'text')} variant  — 'metric' shows a large number, 'text' shows a paragraph
 */
function ScoreCard({ label, value, icon, variant = 'metric' }) {
  return (
    <motion.div
      className={`${styles.card} glass-panel`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className={styles.iconRow}>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
        <span className={styles.label}>{label}</span>
      </div>

      {variant === 'metric' ? (
        <p className={styles.metricValue}>{value}</p>
      ) : (
        <p className={styles.textValue}>{value}</p>
      )}
    </motion.div>
  );
}

export default ScoreCard;
