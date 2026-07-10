import { motion } from 'framer-motion';
import styles from './Button.module.css';

/**
 * Button
 * @param {('primary'|'secondary'|'ghost')} variant
 * @param {('sm'|'md'|'lg')}               size
 * @param {React.ReactNode}                 icon      — optional icon prepended to children
 * @param {boolean}                         disabled
 * @param {function}                        onClick
 * @param {React.ReactNode}                 children
 */
function Button({
  variant  = 'primary',
  size     = 'md',
  icon,
  disabled = false,
  onClick,
  children,
  type     = 'button',
  className = '',
}) {
  return (
    <motion.button
      type={type}
      className={`${styles.btn} ${className}`}
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled   ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {children}
    </motion.button>
  );
}

export default Button;
