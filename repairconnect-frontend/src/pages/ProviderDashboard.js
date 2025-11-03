import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ProviderDashboard.module.css';
import WelcomeMessage from '../components/WelcomeMessage';
import ProfileSection from '../components/ProfileSection';
import JobsSection from '../components/JobsSection';
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
        
        // Temporary mock jobs data
        setJobs([
          {
            id: 1,
            title: 'Fix Leaking Pipe',
            description: 'Kitchen sink pipe is leaking. Need urgent repair.',
            location: 'Downtown',
            requiredRole: 'Plumber',
            budget: 150
          },
        ]);
      } catch (error) {
        console.error('Error fetching provider data:', error);
        setError('Failed to load provider data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
  }, []);

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

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <span className={styles.brandHighlight}>RepairConnect</span> Provider Dashboard
        </h1>
        <p className={styles.pageSubtitle}>
          Manage your profile, showcase your services, and discover new opportunities tailored to you.
        </p>
      </header>
      {provider.firstName && <WelcomeMessage firstName={provider.firstName} email={provider.email} />}
      
      <ProfileSection 
        provider={provider}
        onSave={handleProfileUpdate}
      />
      
      <JobsSection 
        jobs={jobs}
        providerRoles={provider.roles}
      />
    </div>
  );
};

export default ProviderDashboard;
