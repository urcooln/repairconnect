import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ProviderDashboard.module.css';
import WelcomeMessage from '../components/WelcomeMessage';
import ProfileSection from '../components/ProfileSection';
import JobsSection from '../components/JobsSection';
import MyJobs from '../components/MyJobs';
import * as api from '../services/api';
import { isAuthenticated, getUserData } from '../utils/auth';

const ProviderDashboard = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('Checking authentication...');
    const isAuth = isAuthenticated();
    console.log('Is authenticated:', isAuth);
    
    if (!isAuth) {
      console.log('Not authenticated, redirecting to login...');
      navigate('/login');
      return;
    }

    const userData = getUserData();
    console.log('User data:', userData);
    
    if (!userData || userData.role !== 'provider') {
      console.log('Not a provider, redirecting to home...');
      navigate('/');
      return;
    }
    console.log('Authentication check complete');
  }, [navigate]);
  const [provider, setProvider] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roles: [],
    company: '',
    skills: [],
    hourlyRate: null,
    bio: '',
    completedJobs: 0,
    newMessages: 0,
    photoUrl: null
  });
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [earningsError, setEarningsError] = useState(null);

  useEffect(() => {
    const fetchProviderData = async () => {
      try {
        console.log('Fetching provider data...');
        const providerData = await api.getProviderProfile();
        console.log('Provider data received:', providerData);
        setProvider(prevProvider => ({
          ...prevProvider,
          ...providerData,
          skills: Array.isArray(providerData.skills) ? providerData.skills : [],
          hourlyRate: providerData.hourlyRate ?? null,
        }));
      } catch (error) {
        console.error('Error fetching provider data:', error);
        setError('Failed to load provider data. Please try refreshing the page.');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching provider jobs...');
        const jobData = await api.getProviderJobs();
        console.log('Provider jobs received:', jobData);
        setJobs(Array.isArray(jobData) ? jobData : []);
      } catch (jobError) {
        console.error('Error fetching provider jobs:', jobError);
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
    (async () => {
      try {
        const earningsData = await api.getProviderEarnings();
        setEarnings(earningsData);
        setEarningsError(null);
      } catch (err) {
        console.error('Error loading earnings:', err);
        setEarningsError('Unable to load earnings summary');
      }
    })();
  }, []);


  // expose a refresh function to child components
  const refreshJobs = async () => {
    try {
      const jobData = await api.getProviderJobs();
      setJobs(Array.isArray(jobData) ? jobData : []);
      return jobData;
    } catch (err) {
      console.error('Error refreshing jobs:', err);
      return null;
    }
  };

  const handleProfileUpdate = async (updatedProfile) => {
    try {
      const updated = await api.updateProviderProfile(updatedProfile);
      setProvider(prev => ({
        ...prev,
        ...updated,
        skills: Array.isArray(updated.skills) ? updated.skills : [],
        hourlyRate: updated.hourlyRate ?? null,
      }));
      setError(null);
      return updated;
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingMessage}>Loading your dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const earningsStats = earnings ? [
    { label: 'Gross Paid', value: currencyFormatter.format(earnings.totalGross || 0) },
    { label: 'Platform Fees', value: currencyFormatter.format(earnings.totalFees || 0) },
    { label: 'Net Paid', value: currencyFormatter.format(earnings.totalNet || 0) },
    { label: 'Unpaid Invoices', value: currencyFormatter.format(earnings.unpaidGross || 0) },
    { label: 'Platform Fee', value: `${((earnings.feePercent || 0) * 100).toFixed(1)}%` }
  ] : [];

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <ProfileSection 
            provider={provider}
            onSave={handleProfileUpdate}
          />
        </aside>

        <div className={styles.mainContent}>
          <section className={`${styles.contentCard} ${styles.pageIntro}`}>
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>
                <span className={styles.brandHighlight}>RepairConnect</span> Provider Dashboard
              </h1>
              <p className={styles.pageSubtitle}>
                Manage your profile, showcase your services, and discover new opportunities tailored to you.
              </p>
            </header>
            {provider.firstName && (
              <WelcomeMessage firstName={provider.firstName} email={provider.email} />
            )}
          </section>

          {earningsError && <div className={`${styles.contentCard} ${styles.errorCard}`}>{earningsError}</div>}

          {earningsStats.length > 0 && (
            <section className={`${styles.contentCard} ${styles.statsSection}`}>
              <div className={styles.sectionHeaderRow}>
                <h2 className={styles.sectionTitle}>Earnings Snapshot</h2>
                <p className={styles.sectionSubtitle}>Track how much you have earned after platform fees.</p>
              </div>
              <div className={styles.stats}>
                {earningsStats.map((stat) => (
                  <div key={stat.label} className={styles.statBox}>
                    <h3>{stat.label}</h3>
                    <p>{stat.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.rightColumn}>
            <JobsSection 
              jobs={jobs}
              providerRoles={provider.roles}
              refreshJobs={refreshJobs}
            />

            <MyJobs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
