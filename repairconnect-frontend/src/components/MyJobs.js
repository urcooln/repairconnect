import React, { useEffect, useState } from 'react';
import styles from '../pages/ProviderDashboard.module.css';
import * as api from '../services/api';
import { getHeaders } from '../services/api';
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';

const buildAttachmentUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
};

const MyJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [linkLoading, setLinkLoading] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState({ open: false, job: null });
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const fetchMyJobs = async () => {
    setLoading(true);
    try {
      const data = await api.getMyJobs();
      console.log('Fetched my jobs:', data);
      setJobs(Array.isArray(data) ? data : []);
      setError(null);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Failed to load my jobs', err);
      setError('Failed to load your jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();
    const handleExternalRefresh = () => {
      fetchMyJobs();
    };
    window.addEventListener('refresh-my-jobs', handleExternalRefresh);
    return () => window.removeEventListener('refresh-my-jobs', handleExternalRefresh);
  }, []);

  const handleSubmitUpdate = async (jobId, formState, clearForm) => {
    if (!formState.message || formState.message.trim().length === 0) return;
    setPosting(true);
    try {
      await api.postJobUpdate(jobId, { message: formState.message.trim(), imageUrl: formState.imageUrl || null, file: formState.file || null });
      await fetchMyJobs();
      clearForm();
    } catch (err) {
      console.error('Error posting update', err);
      setError('Failed to post update');
    } finally {
      setPosting(false);
    }
  };

  const openInvoiceForJob = (job) => {
    // Prefill notes with a summary of work: job description + recent updates
    let summary = '';
    if (job.description) summary += `Job description:\n${job.description}\n\n`;
    if (job.updates && job.updates.length) {
      summary += 'Work performed:\n';
      // include last 5 updates
      const last = job.updates.slice(-5);
      for (const u of last) {
        if (u.message) summary += `- ${u.message.replace(/\n/g, ' ')}\n`;
      }
      summary += '\n';
    }

    setInvoiceModal({ open: true, job });
    setInvoiceAmount('');
    setInvoiceNotes(summary);
  };

  const closeInvoiceModal = () => setInvoiceModal({ open: false, job: null });

  const submitInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceModal.job) return;
    const amt = Number(invoiceAmount);
    if (!amt || Number.isNaN(amt) || amt <= 0) return alert('Enter a valid amount');
    setPosting(true);
    try {
      await api.createInvoice({ serviceRequestId: invoiceModal.job.id, amount: amt, notes: invoiceNotes });
      await fetchMyJobs();
      closeInvoiceModal();
      // notifications are created server-side; UI refreshes to show the new invoice
    } catch (err) {
      console.error('Failed to create invoice', err, 'response body:', err && err.body ? err.body : null);
      const userMsg = err && (err.message || (err.body && (err.body.error || err.body.message || err.body.text))) ? (err.message || JSON.stringify(err.body)) : 'Failed to create invoice';
      alert(userMsg);
    } finally {
      setPosting(false);
    }
  };

  const endJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to end this job? It will be archived and no longer appear in My Jobs.')) return;
    setPosting(true);
    try {
      const res = await fetch(`http://localhost:8081/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'closed' })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to close job');
      }
      await fetchMyJobs();
    } catch (err) {
      console.error('Failed to end job', err);
      alert(err.message || 'Failed to end job');
    } finally {
      setPosting(false);
    }
  };

  const updateJobStatus = async (jobId, status) => {
    setPosting(true);
    try {
      const res = await fetch(`http://localhost:8081/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update status');
      }
      const newJobs = await fetchMyJobs();
      // if job was just finished, open invoice modal for provider to create invoice
      if ((status || '').toLowerCase() === 'done') {
        const job = (newJobs || []).find(j => j.id === jobId);
        if (job && job.assignedToMe) {
          // small delay to ensure UI updated
          setTimeout(() => openInvoiceForJob(job), 250);
        }
      }
    } catch (err) {
      console.error('Failed to change job status', err);
      setError(err.message || 'Failed to change job status');
    } finally {
      setPosting(false);
    }
  };

  const getPayLink = async (invoiceId) => {
    setLinkLoading(invoiceId);
    try {
      const data = await api.createInvoiceCheckout(invoiceId);
      // NOTE (PAY NOT WORKING): Providers using "Get Pay Link" may see failures when Stripe
      // is not configured locally. Backend will return a `debugUrl` when `INVOICE_DEBUG_ENABLED`
      // is true — the UI copies it to clipboard and prompts to open. If you need a quicker
      // demo flow, consider enabling debug-pay in backend env or configuring Stripe credentials.
      // If a `url` is returned it is a Stripe Checkout URL.
      // If a `debugUrl` is returned it is a local link to mark invoice paid for testing.
      // If payment still fails, inspect backend logs for Stripe errors.
      // If you plan to fix the Stripe flow: ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set.
      // If using webhooks locally, expose a public URL (ngrok) and set `STRIPE_WEBHOOK_SECRET`.

      // If Stripe returned a checkout URL, open it. If backend returned a debugUrl (Stripe not configured), use that.
      if (data && data.url) {
        try { await navigator.clipboard.writeText(data.url); } catch (e) {}
        const openNow = window.confirm('Pay link copied to clipboard. Open it now?');
        if (openNow) window.open(data.url, '_blank');
        return;
      }

      if (data && data.debugUrl) {
        try { await navigator.clipboard.writeText(data.debugUrl); } catch (e) {}
        const openNow = window.confirm('Stripe not configured locally — debug pay link copied. Open it now to mark the invoice paid?');
        if (openNow) window.open(data.debugUrl, '_blank');
        return;
      }

      alert('No pay link returned from server');
    } catch (err) {
      console.error('Failed to generate pay link', err);
      alert(err.message || 'Failed to generate pay link');
    } finally {
      setLinkLoading(null);
    }
  };

  if (loading) return <div className={styles.jobsSection}><div className={styles.loadingMessage}>Loading your assigned jobs...</div></div>;

  return (
    <section className={`${styles.jobsSection} ${styles.myJobsSection}`} aria-label="My Jobs">
      <div className={styles.jobsSectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>My Jobs</h2>
          <p className={styles.sectionSubtitle}>Jobs assigned to you. Post updates to notify customers.</p>
        </div>
      </div>

      {error && <div className={styles.errorText}>{error}</div>}

      {jobs.length === 0 ? (
        <div className={styles.noJobs}>You have no assigned jobs right now.</div>
      ) : (
        <div className={styles.jobsList}>
          {jobs.map(job => (
            <article id={`job-${job.id}`} key={job.id} className={styles.jobCard}>
              <div className={styles.jobCardHeader}>
                <h3>{job.title}</h3>
                        <div className={styles.jobBudget}>{(job.status || '').toUpperCase()}</div>
              </div>

              <p className={styles.jobDescription}>{job.description}</p>
              {Array.isArray(job.attachments) && job.attachments.length > 0 && (
                <div className={styles.attachmentsBlock}>
                  <strong>Customer Attachments</strong>
                  <div className={styles.attachmentsGrid}>
                    {job.attachments.map((att) => {
                      const mediaUrl = buildAttachmentUrl(att.url);
                      return (
                        <a
                          key={`job-${job.id}-attachment-${att.id || mediaUrl}`}
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.attachmentItem}
                        >
                          {att.type === 'video' ? (
                            <video className={styles.attachmentPreview} src={mediaUrl} muted playsInline />
                          ) : (
                            <img className={styles.attachmentPreview} src={mediaUrl} alt={att.originalName || 'Attachment'} />
                          )}
                          {att.type === 'video' && <span className={styles.attachmentLabel}>Video</span>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <strong>Customer:</strong> {job.customerName || job.customerEmail || 'Unknown'}
                {job.customerPhone ? <span> — {job.customerPhone}</span> : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <strong>Updates</strong>
                {(!job.updates || job.updates.length === 0) && <div className={styles.noJobs} style={{ marginTop: 6 }}>No updates yet.</div>}
                <ul style={{ marginTop: 8 }}>
                  {(job.updates || []).map(u => {
                    let imageUrl = u.imageUrl || u.image_url || null;
                    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('/')) {
                      const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
                      imageUrl = `${API_BASE}${imageUrl}`;
                    }

                    return (
                      <li key={u.id} style={{ marginBottom: 12 }}>
                        {u.message && <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>{u.message}</div>}
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.createdAt}</div>
                        {imageUrl && (
                          <div style={{ marginTop: 8 }}>
                            <a href={imageUrl} target="_blank" rel="noreferrer">
                              <img src={imageUrl} alt="update attachment" className={styles.updateImage} />
                            </a>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {job.invoices && job.invoices.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Invoices</strong>
                  <ul style={{ marginTop: 8 }}>
                    {job.invoices.map(inv => (
                      <li key={inv.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>Invoice #{inv.id} — {inv.currency} {Number(inv.amount).toFixed(2)}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>{inv.notes || ''}</div>
                        <div style={{ marginTop: 6 }}>
                          {inv.paid ? <span style={{ display: 'inline-block', padding: '4px 8px', background: '#ecfccb', color: '#14532d', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Paid</span> : (
                            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Unpaid</span>
                              <button onClick={() => getPayLink(inv.id)} disabled={linkLoading === inv.id} style={{ padding: '6px 10px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontSize: 12 }}>{linkLoading === inv.id ? 'Generating…' : 'Get Pay Link'}</button>
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }} className={styles.updateContainer}>
                    <UpdateForm
                      onSubmit={(form, clear) => handleSubmitUpdate(job.id, form, clear)}
                      posting={posting}
                      extraActions={(() => {
                              const s = (job.status || '').toLowerCase();

                              if (s === 'taken') {
                                return (
                                  <>
                                    <button className={`${styles.statusButton} ${styles.statusPrimary}`} onClick={() => updateJobStatus(job.id, 'ongoing')} disabled={posting} title="Mark as in-progress">
                                      In Progress
                                    </button>
                                  </>
                                );
                              }

                              if (s === 'ongoing') {
                                return (
                                  <>
                                    <button className={`${styles.statusButton} ${styles.statusWarn}`} onClick={() => updateJobStatus(job.id, 'paused')} disabled={posting} title="Pause the job">
                                      Pause
                                    </button>
                                    <button className={`${styles.statusButton} ${styles.statusSuccess}`} onClick={() => updateJobStatus(job.id, 'done')} disabled={posting} title="Mark as finished">
                                      Finish
                                    </button>
                                  </>
                                );
                              }

                              if (s === 'paused') {
                                return (
                                  <>
                                    <button className={`${styles.statusButton} ${styles.statusPrimary}`} onClick={() => updateJobStatus(job.id, 'ongoing')} disabled={posting} title="Resume the job">
                                      Resume
                                    </button>
                                    <button className={`${styles.statusButton} ${styles.statusSuccess}`} onClick={() => updateJobStatus(job.id, 'done')} disabled={posting} title="Mark as finished">
                                      Finish
                                    </button>
                                  </>
                                );
                              }

                              // default: no extra action
                              return null;
                        })()}
                    />
                    {((job.status || '').toLowerCase() === 'done' && job.assignedToMe) && (
                          <div style={{ marginTop: 12 }}>
                            {(!job.invoices || job.invoices.length === 0) ? (
                              <button className={styles.editButton} onClick={() => openInvoiceForJob(job)} disabled={posting}>Create Invoice</button>
                            ) : (
                              <button className={styles.cancelButton} onClick={() => endJob(job.id)} disabled={posting}>End Job</button>
                            )}
                          </div>
                        )}
                  </div>
                </div>
              </div>

            </article>
          ))}
        </div>
                    
      )}
      <InvoiceModal
        open={invoiceModal.open}
        job={invoiceModal.job}
        amount={invoiceAmount}
        notes={invoiceNotes}
        onChangeAmount={setInvoiceAmount}
        onChangeNotes={setInvoiceNotes}
        onClose={closeInvoiceModal}
        onSubmit={submitInvoice}
        submitting={posting}
      />
    </section>
  );
};


const UpdateForm = ({ onSubmit, posting, extraActions = null }) => {
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);

  const clear = () => { setMessage(''); setImageUrl(''); setFile(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ message, imageUrl, file }, clear);
  };

  return (
    <form onSubmit={handleSubmit} className={`${styles.editProfileModal} ${styles.updateBox}`} style={{ marginTop: 12 }}>
      <div className={styles.editFormRow} style={{ marginBottom: 8 }}>
        <label>Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write an update for the customer" />
      </div>

      <div className={styles.editFormRow} style={{ marginBottom: 8 }}>
        <label>Image URL (optional)</label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
      </div>

      <div className={styles.editFormRow} style={{ marginBottom: 8 }}>
        <label>Or upload image</label>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files && e.target.files[0])} />
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelButton} onClick={clear} disabled={posting}>Clear</button>
        <button type="submit" className={styles.editButton} disabled={posting || !message.trim()}>{posting ? 'Posting...' : 'Post Update'}</button>
        {extraActions ? <div style={{ display: 'flex', gap: 8, marginLeft: 8, alignItems: 'center' }}>{extraActions}</div> : null}
      </div>
    </form>
  );
};

// Invoice modal markup rendered near the bottom of this file via conditional
const InvoiceModal = ({ open, job, amount, notes, onChangeAmount, onChangeNotes, onClose, onSubmit, submitting }) => {
  if (!open || !job) return null;
  return (
    <div className={styles.editProfileOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.editProfileModal} role="dialog" aria-modal="true">
        <h3 className={styles.modalTitle}>Create Invoice</h3>
        <div style={{ marginBottom: 12 }}><strong>For:</strong> {job.title || job.category}</div>
        <form onSubmit={onSubmit}>
          <div className={styles.editFormRow}>
            <label>Amount (USD)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => onChangeAmount(e.target.value)} placeholder="0.00" />
          </div>

          <div className={styles.editFormRow}>
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => onChangeNotes(e.target.value)} rows={4} />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className={styles.editButton} disabled={submitting || !amount}>{submitting ? 'Creating...' : 'Create Invoice'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MyJobs;

// Render invoice modal from component state
// (we rely on `invoiceModal` state inside `MyJobs`; the modal is mounted via JSX in that component)
