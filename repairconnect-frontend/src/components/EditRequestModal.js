import React, { useEffect, useMemo, useState } from 'react';
import { updateRequest, addRequestAttachments, deleteRequestAttachment } from '../services/api';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const formatSize = (size = 0) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};

const buildMediaUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
};

export default function EditRequestModal({ request, onClose, onSaved, categories = [] }) {
  const [title, setTitle] = useState(request.title || '');
  const [category, setCategory] = useState(request.category || '');
  const [description, setDescription] = useState(request.description || '');
  const [preferredDate, setPreferredDate] = useState(request.preferred_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [existingAttachments, setExistingAttachments] = useState(request.attachments || []);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);

  useEffect(() => {
    setTitle(request.title || '');
    setCategory(request.category || '');
    setDescription(request.description || '');
    setPreferredDate(request.preferred_date || '');
    setExistingAttachments(request.attachments || []);
    setAttachmentsToDelete([]);
    setNewAttachments([]);
    setError('');
    setAttachmentError('');
  }, [request]);

  const remainingSlots = useMemo(() => {
    return Math.max(0, MAX_ATTACHMENTS - (existingAttachments.length + newAttachments.length));
  }, [existingAttachments.length, newAttachments.length]);

  const handleRemoveExisting = (attachment) => {
    if (!attachment || !attachment.id) return;
    setExistingAttachments((prev) => prev.filter((att) => att.id !== attachment.id));
    setAttachmentsToDelete((prev) => (prev.includes(attachment.id) ? prev : [...prev, attachment.id]));
  };

  const handleAddNewFiles = (event) => {
    setAttachmentError('');
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setNewAttachments((prev) => {
      const next = [...prev];
      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          setAttachmentError('Only image or video files are allowed.');
          continue;
        }
        if (file.size > MAX_ATTACHMENT_SIZE) {
          setAttachmentError('Each file must be 20MB or smaller.');
          continue;
        }
        const total = existingAttachments.length + next.length;
        if (total >= MAX_ATTACHMENTS) {
          setAttachmentError(`You can only have up to ${MAX_ATTACHMENTS} attachments per request.`);
          break;
        }
        next.push(file);
      }
      return next;
    });

    if (event.target && typeof event.target.value !== 'undefined') {
      event.target.value = '';
    }
  };

  const handleRemoveNewFile = (index) => {
    setNewAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setError('');
    setAttachmentError('');
    if (!title.trim() || !category || !description.trim()) {
      setError('Please fill required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        preferred_date: preferredDate || null
      };

      await updateRequest(request.id, payload);

      if (attachmentsToDelete.length) {
        await Promise.all(
          attachmentsToDelete.map((attachmentId) =>
            deleteRequestAttachment(request.id, attachmentId)
          )
        );
      }

      if (newAttachments.length) {
        await addRequestAttachments(request.id, newAttachments);
      }

      if (onSaved) onSaved();
    } catch (err) {
      console.error('Update failed', err);
      if (err && err.status === 409) {
        setError('This request was changed by the system. Please reload and try again.');
      } else if (err && err.status === 403) {
        setError('You are not allowed to edit this request.');
      } else {
        setError(err.message || 'Failed to update request');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 720, maxWidth: '94%', background: 'white', borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: '0 0 12px 0' }}>Edit Request</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Category *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <option value="">Select a category</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Attachments</label>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#6b7280' }}>Add up to {MAX_ATTACHMENTS} total attachments (images or videos, max 20MB each). Changes apply when you save.</p>

          {existingAttachments.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Current attachments</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {existingAttachments.map((att) => {
                  const mediaUrl = buildMediaUrl(att.url);
                  const isVideo = att.type === 'video';
                  return (
                    <div key={att.id} style={{ width: 96, height: 96, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative', background: '#f8fafc' }}>
                      {isVideo ? (
                        <video src={mediaUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <img src={mediaUrl} alt={att.originalName || 'Attachment'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveExisting(att)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(15,23,42,0.75)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '999px',
                          padding: '2px 6px',
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {newAttachments.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Pending uploads</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newAttachments.map((file, idx) => (
                  <li key={`${file.name}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', background: '#f9fafb' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{file.type.startsWith('video/') ? 'Video' : 'Image'} • {formatSize(file.size)}</div>
                    </div>
                    <button type="button" onClick={() => handleRemoveNewFile(idx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }} disabled={saving}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <input type="file" accept="image/*,video/*" multiple onChange={handleAddNewFiles} disabled={remainingSlots <= 0 || saving} />
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>Slots remaining: {remainingSlots}</div>
          {attachmentError && <div style={{ marginTop: 8, color: '#b91c1c' }}>{attachmentError}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Preferred Date (optional)</label>
          <input type="datetime-local" value={preferredDate || ''} onChange={(e) => setPreferredDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>

        {error && <div style={{ marginBottom: 12, color: '#b91c1c' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f3f4f6' }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '8px 12px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none' }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
