import React, { useEffect, useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';

const WelcomeMessage = ({ firstName, email }) => {
  const [visible, setVisible] = useState(true);
  
  console.log('WelcomeMessage props:', { firstName, email });

  useEffect(() => {
    console.log('WelcomeMessage mounted');
    // Hide message after 2 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      console.log('WelcomeMessage timer completed');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.welcomeMessage} onClick={handleClick}>
      <div className={styles.welcomeContent}>
        <h2>Welcome, {firstName}!</h2>
        <p>{email}</p>
      </div>
    </div>
  );
};

export default WelcomeMessage;