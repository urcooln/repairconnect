import React, { useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';

const WelcomeMessage = ({ firstName, email }) => {
  const [visible, setVisible] = useState(true);

  if (!firstName || !visible) {
    return null;
  }

  return (
    <div className={styles.welcomeMessage} role="region" aria-live="polite">
      <div className={styles.welcomeContent}>
        <span className={styles.welcomeLabel}>Welcome back</span>
        <h2 className={styles.welcomeName}>{firstName}</h2>
        {email && <p className={styles.welcomeEmail}>{email}</p>}
      </div>
      <button
        type="button"
        className={styles.welcomeDismiss}
        onClick={() => setVisible(false)}
        aria-label="Dismiss welcome message"
      >
        {'\u00D7'}
      </button>
    </div>
  );
};

export default WelcomeMessage;
