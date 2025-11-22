import React, { useEffect, useState, useRef } from 'react';
import * as api from '../services/api';
import { createInvoiceCheckout, getHeaders } from '../services/api';

const Notifications = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef();

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const unread = items.filter(i => !i.read).length;

  const markRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      await fetch();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const payInvoice = async (invoiceId) => {
    try {
      const data = await createInvoiceCheckout(invoiceId);
      if (data && data.url) {
        window.location.href = data.url;
        return;
      }

      if (data && data.debugUrl) {
        try { await navigator.clipboard.writeText(data.debugUrl); } catch (e) {}
        const openNow = window.confirm('Stripe not configured locally — debug pay link copied. Open it now to mark the invoice paid?');
        if (openNow) window.open(data.debugUrl, '_blank');
        return;
      }

      alert('No checkout URL returned');
    } catch (err) {
      console.error('Failed to create checkout', err);
      alert(err.message || 'Failed to create checkout');
    }
  };

  const downloadInvoicePdf = async (invoiceId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081'}/invoices/${invoiceId}/pdf`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to download PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF', err);
      alert(err.message || 'Failed to download PDF');
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(v => !v)} style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }} aria-label="Notifications">
        🔔
        {unread > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: 12, padding: '2px 6px', fontSize: 12 }}>{unread}</span>}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, marginTop: 8, width: 360, background: 'white', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 1200 }}>
          <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Notifications</strong>
            <button onClick={() => { setItems([]); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {loading && <div style={{ padding: 12 }}>Loading…</div>}
            {!loading && items.length === 0 && <div style={{ padding: 12, color: '#666' }}>No notifications</div>}
            {!loading && items.map(item => {
              const payload = item.payload || {};
              // payload may be stored as string in some cases
              const p = (typeof payload === 'string') ? (() => { try { return JSON.parse(payload); } catch (e) { return { message: payload }; } })() : payload;
              const message = p.message || (p.status ? `Status: ${p.status}` : '') || '';
              let imageUrl = p.imageUrl || p.image_url || null;
              // Resolve relative backend paths to full URL so the frontend can load them
              if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('/')) {
                const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
                imageUrl = `${API_BASE}${imageUrl}`;
              }

              return (
                <div key={item.id} style={{ padding: 12, borderBottom: '1px solid #f2f4f7', background: item.read ? 'white' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#0f172a' }}>{item.type || 'notification'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(item.createdAt).toLocaleString()}</div>
                  </div>

                  {message && <div style={{ marginTop: 6, fontSize: 14, color: '#334155' }}>{message}</div>}

                  {/* If this is an invoice notification, surface the service request / invoice id and amount */}
                  {item.type === 'invoice' && p && p.invoiceId && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                      <strong>Invoice:</strong> #{p.invoiceId}{p.serviceRequestId ? ` — Request #${p.serviceRequestId}` : ''}
                      {p.amount ? ` — ${p.currency || 'USD'} ${Number(p.amount).toFixed(2)}` : ''}
                    </div>
                  )}

                  {imageUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={imageUrl} target="_blank" rel="noreferrer">
                        <img src={imageUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e6eefc' }} />
                      </a>
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {!item.read && <button onClick={() => markRead(item.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Mark read</button>}
                    {item.type === 'invoice' && p && p.invoiceId && (
                      <>
                        {/* Remove direct Pay action from notification list; keep download/view only */}
                        <button onClick={() => downloadInvoicePdf(p.invoiceId)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Download Invoice</button>
                      </>
                    )}
                    {item.type === 'invoice_paid' && p && p.invoiceId && (
                      <button onClick={() => downloadInvoicePdf(p.invoiceId)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Download Receipt</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
