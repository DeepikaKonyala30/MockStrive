import { motion } from 'framer-motion';
import styles from './ChatBubble.module.css';

/**
 * ChatBubble
 * @param {string}          message
 * @param {('agent'|'user')} role
 * @param {string}          timestamp  — optional display string
 */
function ChatBubble({ message, role = 'agent', timestamp }) {
  const isAgent = role === 'agent';

  return (
    <motion.div
      className={`${styles.wrapper} ${isAgent ? styles.agent : styles.user}`}
      initial={{ opacity: 0, x: isAgent ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={`${styles.bubble} ${isAgent ? styles.agentBubble : styles.userBubble}`}>
        <p className={styles.message}>{message}</p>
        {timestamp && (
          <span className={styles.timestamp}>{timestamp}</span>
        )}
      </div>
    </motion.div>
  );
}

export default ChatBubble;
