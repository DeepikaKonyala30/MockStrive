import { motion } from 'framer-motion';
import {
  FiCode, FiServer, FiPackage, FiCpu, FiZap,
} from 'react-icons/fi';
import { Card } from '../../components/index.js';
import styles from './About.module.css';

const TECH_STACK = [
  { icon: <FiCode />,    label: 'React 18 + Vite'  },
  { icon: <FiServer />,  label: 'Node.js + Express' },
  { icon: <FiPackage />, label: 'React Router v6'   },
  { icon: <FiZap />,     label: 'Framer Motion'     },
  { icon: <FiCpu />,     label: 'IBM watsonx.ai'    },
];

const STEPS = [
  { n: '01', title: 'Create Your Profile',  body: 'Enter your target role, skills, and a brief resume summary so the AI can tailor its questions.' },
  { n: '02', title: 'Start the Interview',  body: 'The AI generates context-aware questions and evaluates your answers in real time.' },
  { n: '03', title: 'Receive Your Report',  body: 'Review detailed scorecards covering technical depth, communication, and confidence — with specific learning topics.' },
];

function About() {
  return (
    <motion.div
      className={`${styles.page} page-wrapper`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className={`${styles.inner} container`}>
        {/* About card */}
        <Card title="About MockStrive" animate={false} className={styles.card}>
          <p className={styles.description}>
            MockStrive is an AI-powered interview coaching platform built with React, Express, and IBM watsonx.ai. It uses Meta Llama 3.3 70B Instruct as the primary model (with IBM Granite 8B as an automatic fallback) to deliver personalised mock interviews, real-time AI evaluations, and detailed performance reports.
          </p>

          <div className={styles.stackSection}>
            <h3 className={styles.stackTitle}>Tech Stack</h3>
            <ul className={styles.stackList}>
              {TECH_STACK.map(({ icon, label }) => (
                <li key={label} className={styles.stackItem}>
                  <span className={styles.stackIcon} aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* How it works card */}
        <Card title="How It Works" animate={false} className={styles.card}>
          <ol className={styles.stepList}>
            {STEPS.map(({ n, title, body }) => (
              <li key={n} className={styles.step}>
                <span className={styles.stepNum}>{n}</span>
                <div className={styles.stepContent}>
                  <h4 className={styles.stepTitle}>{title}</h4>
                  <p  className={styles.stepBody}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </motion.div>
  );
}

export default About;
