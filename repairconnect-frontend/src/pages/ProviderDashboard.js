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
          ...providerData
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
      await api.updateProviderProfile(updatedProfile);
      setProvider(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      // Handle error appropriately
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
      <h1>Dashboard Test</h1>
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
