import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from '../pages/ProviderDashboard.module.css';
// Keep JobsSection focused on opportunities; job lifecycle (start/finish/invoice)
// is handled in `MyJobs` to ensure invoices are created in the job context.

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

const JobsSection = ({ jobs = [], providerRoles = [], refreshJobs = null }) => {
  const [selectedRole, setSelectedRole] = useState('all');
  const [disabledJobs, setDisabledJobs] = useState([]);
  const [contactModal, setContactModal] = useState({ open: false, job: null });
  const [modalClosing, setModalClosing] = useState(false);

  const roleFilters = providerRoles
    .filter((role) => typeof role === 'string' && role.trim().length > 0)
    .filter((role) => role.toLowerCase() !== 'provider');

  const filteredJobs = selectedRole === 'all'
    ? jobs
    : jobs.filter((job) => {
        const jobCategory = normalizeValue(job.category || job.requiredRole);
        return jobCategory === normalizeValue(selectedRole);
      });

  const handleContact = async (job) => {
    const jobId = job?.id;
    if (disabledJobs.includes(jobId)) return; // prevent rapid clicks

    const email = job.customerEmail || job.customer_email;
    const phone = job.customerPhone || job.customer_phone;
    const title = job.title || job.category || 'Service Request';

    if ((!email || typeof email !== 'string' || email.trim().length === 0) && (!phone || typeof phone !== 'string' || phone.trim().length === 0)) {
      // eslint-disable-next-line no-alert
      alert('Customer contact information is not available for this request.');
      return;
    }

    // disable this job button briefly to avoid multiple popups
    setDisabledJobs((prev) => [...prev, jobId]);
    setTimeout(() => setDisabledJobs((prev) => prev.filter((id) => id !== jobId)), 2000);

    const subject = `Regarding your service request: ${title}`;
    const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : null;

    // Open modal with choices instead of auto-handling everything
    setModalClosing(false);
    setContactModal({ open: true, job });
  };

  const updateJobStatus = async (job, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8081/provider/jobs/${job.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update status');
      }
      // refresh parent job list if possible
      if (typeof refreshJobs === 'function') await refreshJobs();
      // no immediate invoice UI here; job management/invoicing happens in MyJobs
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message || 'Failed to update job status');
    }
  };

  

  const closeModal = () => {
    if (modalClosing) return;
    setModalClosing(true);
    // play closing animation then actually close
    setTimeout(() => {
      setContactModal({ open: false, job: null });
      setModalClosing(false);
    }, 180);
  };

  // close on Escape and manage body scroll when modal is open
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && contactModal.open) closeModal();
    };

    if (contactModal.open) {
      document.body.classList.add('modal-open');
      window.addEventListener('keydown', onKey);
    }

    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [contactModal.open]);

  const openGmail = (email, job) => {
    const title = job.title || job.category || 'Service Request';
    const subject = `Regarding your service request: ${title}`;
    const body = encodeURIComponent(`${title}\n\n${job.description || ''}\n\nRequest ID: ${job.id}`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  // phone copy removed; phone will be shown as a clickable tel: link

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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={styles.applyButton} onClick={() => handleContact(job)} disabled={disabledJobs.includes(job.id)}>
                  Contact Customer
                </button>

                {/* Status actions for providers */}
                { (job.status || 'pending') === 'pending' && (
                  <button
                    className={styles.secondaryButton}
                    onClick={() => updateJobStatus(job, 'taken')}
                  >
                    Take Job
                  </button>
                )}

                { (job.status || '') !== 'pending' && (
                  // For taken/ongoing/done, direct providers to manage the job in My Jobs
                  <button className={styles.secondaryButton} onClick={() => {
                    const el = document.getElementById(`job-${job.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.style.transition = 'box-shadow 0.3s ease';
                      el.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
                      setTimeout(() => { el.style.boxShadow = ''; }, 1600);
                    } else {
                      alert('Open "My Jobs" to manage this job.');
                    }
                  }}>Manage in My Jobs</button>
                )}
              </div>
            </div>
          </article>
        ))}
          {/* Contact modal */}
          {contactModal.open && contactModal.job && ReactDOM.createPortal(
              <div
                className={styles.modalOverlay}
                onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
              >
                <div className={modalClosing ? styles.modalContentExit : styles.modalContentEnter} role="dialog" aria-modal="true">
                  <h3>Contact Customer</h3>
                  <p>Choose how you'd like to contact the customer for this request:</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    { (contactModal.job.customerPhone || contactModal.job.customer_phone) ? (
                      <button
                        onClick={() => {
                          const phone = contactModal.job.customerPhone || contactModal.job.customer_phone;
                          // navigate to tel: to trigger call on devices with telephony handlers
                          window.location.href = `tel:${phone}`;
                          closeModal();
                        }}
                        className={styles.saveButton}
                      >
                        Call Customer
                      </button>
                    ) : null}

                    { (contactModal.job.customerEmail || contactModal.job.customer_email) ? (
                      <button
                        onClick={() => {
                          const email = contactModal.job.customerEmail || contactModal.job.customer_email;
                          openGmail(email, contactModal.job);
                          closeModal();
                        }}
                        className={styles.saveButton}
                      >
                        Open in Gmail
                      </button>
                    ) : null}
                    {/* Customer phone display + copy */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, color: '#37474f' }}>Customer phone</span>
                        {contactModal.job.customerPhone || contactModal.job.customer_phone ? (
                          <a
                            href={`tel:${contactModal.job.customerPhone || contactModal.job.customer_phone}`}
                            style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}
                          >
                            {contactModal.job.customerPhone || contactModal.job.customer_phone}
                          </a>
                        ) : (
                          <strong>Not provided</strong>
                        )}
                      </div>
                    </div>
                    <button onClick={closeModal} className={styles.cancelButton}>Cancel</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
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
