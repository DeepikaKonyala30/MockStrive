import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiCpu } from 'react-icons/fi';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { to: '/',          label: 'Home'      },
  { to: '/profile',   label: 'Profile'   },
  { to: '/interview/plan', label: 'Interview' },
  { to: '/report',    label: 'Report'    },
  { to: '/about',     label: 'About'     },
];


function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      className={`${styles.navbar} glass-panel`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className={styles.inner}>
        {/* Logo */}
        <NavLink to="/" className={styles.logo} onClick={() => setOpen(false)}>
          <FiCpu className={styles.logoIcon} />
          <span>InterviewIQ</span>
        </NavLink>

        {/* Desktop links */}
        <ul className={styles.links}>
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.link} ${isActive ? styles.active : ''}`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Hamburger */}
        <button
          className={styles.hamburger}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <motion.ul
          className={styles.drawer}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.drawerLink} ${isActive ? styles.active : ''}`
                }
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </motion.ul>
      )}
    </motion.nav>
  );
}

export default Navbar;
