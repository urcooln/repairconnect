import React, { useEffect, useState, useRef } from 'react';
import * as api from '../services/api';

export default function InvoiceCenter() {
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const ref = useRef();

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.getInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load invoices', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchInvoices();
  }, [open]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const unpaidCount = invoices.filter(i => !i.paid).length;

  const handlePay = async (id) => {
    setBusyId(id);
    try {
      const data = await api.createInvoiceCheckout(id);
      // NOTE (PAY NOT WORKING): If Stripe is not configured, the server may return a
      // `{ debugUrl }` instead of a real Stripe `url`. The UI handles both, but if you
      // see payment failures for customers, verify backend env `INVOICE_DEBUG_ENABLED` or
      // configure Stripe credentials.
      if (data && data.url) {
        window.location.href = data.url;
        return;
      }

      // If backend returned a debugUrl (Stripe not configured locally), copy and open it
      if (data && data.debugUrl) {
        try { await navigator.clipboard.writeText(data.debugUrl); } catch (e) {}
        const openNow = window.confirm('Stripe not configured locally — debug pay link copied. Open it now to mark the invoice paid?');
        if (openNow) window.open(data.debugUrl, '_blank');
        // Refresh list after short delay in case debug route was used
        setTimeout(() => fetchInvoices(), 800);
        return;
      }

      // Fallbacks preserved for older behavior
      if (process.env.REACT_APP_INVOICE_DEBUG_ENABLED === 'true') {
        try {
          await api.debugPayInvoice(id);
          await fetchInvoices();
          console.log('Invoice marked paid via debug route');
          return;
        } catch (e) {
          console.error('Debug pay failed', e);
        }
      }

      if (window.confirm('Stripe not configured. Mark invoice as paid locally?')) {
        await api.markInvoicePaid(id);
        await fetchInvoices();
        alert('Invoice marked paid');
      }
    } catch (err) {
      console.error('Create checkout failed', err);
      if (err && err.status === 501) {
        if (window.confirm('Stripe not configured. Mark invoice as paid locally?')) {
          try {
            await api.markInvoicePaid(id);
            await fetchInvoices();
            alert('Invoice marked paid');
          } catch (e) {
            alert(e.message || 'Failed to mark paid');
          }
        }
      } else {
        alert(err.message || 'Failed to start payment');
      }
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081'}/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'Failed to download PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download PDF failed', err);
      alert(err.message || 'Failed to download PDF');
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 8 }}>
      <button onClick={() => setOpen(v => !v)} style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }} aria-label="Invoices">
        🧾
        {unpaidCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: 12, padding: '2px 6px', fontSize: 12 }}>{unpaidCount}</span>}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, marginTop: 8, width: 420, background: 'white', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 1200 }}>
          <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Invoices</strong>
            <button onClick={() => fetchInvoices()} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Refresh</button>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {loading && <div style={{ padding: 12 }}>Loading…</div>}
            {!loading && invoices.length === 0 && <div style={{ padding: 12, color: '#666' }}>No invoices</div>}
            {!loading && invoices.map(inv => (
              <div key={inv.id} style={{ padding: 12, borderBottom: '1px solid #f2f4f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#0f172a' }}>{inv.serviceTitle || `Request #${inv.serviceRequestId}`}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(inv.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ marginTop: 6 }}>{inv.notes}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {!inv.paid && <button onClick={() => handlePay(inv.id)} disabled={busyId === inv.id} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer' }}>{busyId === inv.id ? 'Processing…' : 'Pay'}</button>}
                  <button onClick={() => downloadPdf(inv.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>{inv.paid ? 'Download PDF' : 'Download Invoice'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
