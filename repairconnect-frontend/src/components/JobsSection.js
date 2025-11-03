import React, { useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';

const JobsSection = ({ jobs, providerRoles }) => {
  const [selectedRole, setSelectedRole] = useState('all');

  const filteredJobs = selectedRole === 'all'
    ? jobs
    : jobs.filter(job => job.requiredRole === selectedRole);

  return (
    <section className={styles.jobsSection}>
      <div className={styles.jobsSectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Opportunities</h2>
          <p className={styles.sectionSubtitle}>
            Select a specialty to narrow the jobs that best match your services.
          </p>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${selectedRole === 'all' ? styles.active : ''}`}
            onClick={() => setSelectedRole('all')}
          >
            All Jobs
          </button>
          {providerRoles
            .filter(role => role && role.toLowerCase() !== 'provider')
            .map(role => (
              <button
                key={role}
                className={`${styles.tab} ${selectedRole === role ? styles.active : ''}`}
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </button>
            ))}
        </div>
      </div>

      <div className={styles.jobsList}>
        {filteredJobs.map(job => (
          <article key={job.id} className={styles.jobCard}>
            <div className={styles.jobCardHeader}>
              <h3>{job.title}</h3>
              <span className={styles.jobBudget}>
                ${Number(job.budget).toLocaleString()}
              </span>
            </div>
            <p className={styles.jobDescription}>{job.description}</p>
            <div className={styles.jobMeta}>
              <span className={`${styles.jobTag} ${styles.jobTagLocation}`}>
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 20 20"
                  className={styles.jobTagIcon}
                >
                  <path
                    fill="currentColor"
                    d="M10 2.5a5.5 5.5 0 0 0-5.5 5.5c0 3.037 2.174 5.737 4.217 7.61.664.61 1.616.61 2.28 0C13.326 13.737 15.5 11.037 15.5 8A5.5 5.5 0 0 0 10 2.5Zm0 8.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z"
                  />
                </svg>
                <span>
                  <span className={styles.jobTagLabel}>Location:</span> {job.location}
                </span>
              </span>
              <span className={styles.jobTag}>
                {job.requiredRole}
              </span>
            </div>
            <div className={styles.jobFooter}>
              <button className={styles.applyButton}>
                Apply for this job
              </button>
            </div>
          </article>
        ))}
        {filteredJobs.length === 0 && (
          <p className={styles.noJobs}>
            No jobs available for the selected role right now. Check back soon!
          </p>
        )}
      </div>
    </section>
  );
};

export default JobsSection;
