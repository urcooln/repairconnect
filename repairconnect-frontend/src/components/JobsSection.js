import React, { useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';

const JobsSection = ({ jobs, providerRoles }) => {
  const [selectedRole, setSelectedRole] = useState('all');

  const filteredJobs = selectedRole === 'all'
    ? jobs
    : jobs.filter(job => job.requiredRole === selectedRole);

  return (
    <div className={styles.jobsSection}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedRole === 'all' ? styles.active : ''}`}
          onClick={() => setSelectedRole('all')}
        >
          All Jobs
        </button>
        {providerRoles.map(role => (
          <button
            key={role}
            className={`${styles.tab} ${selectedRole === role ? styles.active : ''}`}
            onClick={() => setSelectedRole(role)}
          >
            {role}
          </button>
        ))}
      </div>

      <div className={styles.jobsList}>
        {filteredJobs.map(job => (
          <div key={job.id} className={styles.jobCard}>
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <div className={styles.jobMeta}>
              <span>Location: {job.location}</span>
              <span>Required Role: {job.requiredRole}</span>
              <span>Budget: ${job.budget}</span>
            </div>
            <button className={styles.applyButton}>
              Apply for Job
            </button>
          </div>
        ))}
        {filteredJobs.length === 0 && (
          <p className={styles.noJobs}>
            No jobs available for the selected role.
          </p>
        )}
      </div>
    </div>
  );
};

export default JobsSection;