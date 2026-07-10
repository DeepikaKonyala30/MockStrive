import { motion } from 'framer-motion';
import styles from './Loader.module.css';

const SIZE_MAP = { sm: 24, md: 40, lg: 60 };

/**
 * Loader — animated spinner
 * @param {('sm'|'md'|'lg')} size
 * @param {string}           label  — accessible screen-reader text
 */
function Loader({ size = 'md', label = 'Loading…' }) {
  const px = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <div className={styles.container} role="status" aria-label={label}>
      <motion.span
        className={styles.ring}
        style={{ width: px, height: px }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Loader;
