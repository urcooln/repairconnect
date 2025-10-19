import React, { useState, useEffect } from 'react';
import { getMyProfile } from '../services/api';
import styles from './CustomerDashboard.module.css';

function CustomerDashboard() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getMyProfile();
        setUser(profile);
      } catch (err) {
        setError('Failed to load profile. Please try logging in again.');
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Welcome, {user ? user.name : 'Customer'}!</h1>
        <p>This is your personal dashboard.</p>
      </header>
      <main className={styles.mainContent}>
        <section className={styles.widget}>
          <h2>My Projects</h2>
          <p>You have no active projects.</p>
          {/* Placeholder for project list */}
        </section>
        <section className={styles.widget}>
          <h2>Account Details</h2>
          {error && <p className={styles.error}>{error}</p>}
          {user ? (
            <div>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Status:</strong> {user.status}</p>
            </div>
          ) : (
            <p>Loading account details...</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default CustomerDashboard;
