import { motion } from 'framer-motion';
import styles from './ProgressBar.module.css';

/**
 * ProgressBar
 * @param {number} value    — 0 to 100
 * @param {string} label    — descriptive label shown above the bar
 * @param {string} color    — optional CSS color override for the fill
 */
function ProgressBar({ value = 0, label, color }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <span className={styles.percent}>{clamped}%</span>
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          className={styles.fill}
          style={color ? { background: color } : undefined}
          initial={{ width: '0%' }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
