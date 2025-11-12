import React, { useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';

const formatDateTime = (value, timeZone) => {
  if (!value) return 'Not provided';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const formatterOptions = { dateStyle: 'medium', timeStyle: 'short' };

  try {
    return new Intl.DateTimeFormat(
      undefined,
      timeZone ? { ...formatterOptions, timeZone } : formatterOptions
    ).format(parsed);
  } catch (err) {
    console.warn('Failed to format date with timezone', err);
    return parsed.toLocaleString();
  }
};

const normalizeValue = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const JobsSection = ({ jobs = [], providerRoles = [] }) => {
  const [selectedRole, setSelectedRole] = useState('all');

  const roleFilters = providerRoles
    .filter((role) => typeof role === 'string' && role.trim().length > 0)
    .filter((role) => role.toLowerCase() !== 'provider');

  const filteredJobs = selectedRole === 'all'
    ? jobs
    : jobs.filter((job) => {
        const jobCategory = normalizeValue(job.category || job.requiredRole);
        return jobCategory === normalizeValue(selectedRole);
      });

  return (
    <section className={styles.jobsSection}>
      <div className={styles.jobsSectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Opportunities</h2>
          <p className={styles.sectionSubtitle}>
            Select a specialty to narrow the jobs that best match your services.
          </p>
        </div>
        {roleFilters.length > 0 && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${selectedRole === 'all' ? styles.active : ''}`}
              onClick={() => setSelectedRole('all')}
            >
              All Jobs
            </button>
            {roleFilters.map((role) => (
              <button
                key={role}
                className={`${styles.tab} ${selectedRole === role ? styles.active : ''}`}
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.jobsList}>
        {filteredJobs.map(job => (
          <article key={job.id} className={styles.jobCard}>
            <div className={styles.jobCardHeader}>
              <div>
                <h3>{job.title || job.category || 'Service Request'}</h3>
                {job.category && (
                  <p className={styles.sectionSubtitle} style={{ margin: '4px 0 0' }}>
                    Category: {job.category}
                  </p>
                )}
              </div>
              <span className={styles.jobBudget}>
                {(job.status || 'pending').toUpperCase()}
              </span>
            </div>
            <p className={styles.jobDescription}>{job.description}</p>
            <div className={styles.jobMeta}>
              {job.customerName && (
                <span className={styles.jobTag}>
                  <span className={styles.jobTagLabel}>Customer:</span> {job.customerName}
                </span>
              )}
              <span className={styles.jobTag}>
                <span className={styles.jobTagLabel}>Requested:</span> {formatDateTime(job.createdAt || job.created_at)}
              </span>
              {job.preferredDate && (
                <span className={styles.jobTag}>
                  <span className={styles.jobTagLabel}>Preferred:</span>{' '}
                  {formatDateTime(job.preferredDate, job.preferredTimezone)}
                  {job.preferredTimezone && (
                    <span className={styles.jobTagTimezone}>
                      ({job.preferredTimezone})
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className={styles.jobFooter}>
              <button className={styles.applyButton}>
                Contact Customer
              </button>
            </div>
          </article>
        ))}
        {filteredJobs.length === 0 && (
          <p className={styles.noJobs}>
            No service requests available for the selected filter right now. Check back soon!
          </p>
        )}
      </div>
    </section>
  );
};

export default JobsSection;
