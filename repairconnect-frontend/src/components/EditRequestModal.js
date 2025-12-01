import React, { useState } from 'react';
import { updateRequest } from '../services/api';

export default function EditRequestModal({ request, onClose, onSaved, categories = [] }) {
  const [title, setTitle] = useState(request.title || '');
  const [category, setCategory] = useState(request.category || '');
  const [description, setDescription] = useState(request.description || '');
  const [preferredDate, setPreferredDate] = useState(request.preferred_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
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
