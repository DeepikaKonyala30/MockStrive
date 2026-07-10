import { motion } from 'framer-motion';
import styles from './Card.module.css';

/**
 * Card
 * @param {string}          title
 * @param {string}          subtitle
 * @param {React.ReactNode} children
 * @param {string}          className  — extra class for composition
 * @param {boolean}         animate    — enable enter animation (default true)
 */
function Card({ title, subtitle, children, className = '', animate = true }) {
  const motionProps = animate
    ? {
        initial:    { opacity: 0, y: 20 },
        animate:    { opacity: 1, y: 0  },
        exit:       { opacity: 0, y: -10 },
        transition: { duration: 0.35, ease: 'easeOut' },
      }
    : {};

  return (
    <motion.div
      className={`${styles.card} glass-panel ${className}`}
      {...motionProps}
    >
      {(title || subtitle) && (
        <div className={styles.header}>
          {title    && <h2 className={styles.title}>{title}</h2>}
          {subtitle && <p  className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </motion.div>
  );
}

export default Card;
