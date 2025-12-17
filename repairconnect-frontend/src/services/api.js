// src/services/api.js
import { getToken } from '../utils/auth';

const API_URL = "http://localhost:8081"; // Test backend server port

// Helper to attach auth headers
export function getHeaders(options = {}) {
  const { json = true } = options;
  const token = getToken();
  const headers = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function getRequests() {
  const res = await fetch(`${API_URL}/requests`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch requests');
  return res.json();
}

export async function createRequest(data) {
  const res = await fetch(`${API_URL}/requests`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create request');
  return res.json();
}

export const login = async (email, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  if (!res.ok) {
    throw new Error('Login failed');
  }
  
  return res.json();
};

export const getProviderProfile = async () => {
  const res = await fetch(`${API_URL}/provider/profile`, {
    headers: getHeaders()
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch provider profile');
  }
  
  return res.json();
};

export const updateProviderProfile = async (profileData) => {
  const res = await fetch(`${API_URL}/provider/profile`, {
    method: 'PUT',
    headers: {
      ...getHeaders()
    },
    body: JSON.stringify(profileData)
  });
  
  if (!res.ok) {
    throw new Error('Failed to update provider profile');
  }
  
  return res.json();
};

export const uploadProviderPhoto = async (photoFile) => {
  const formData = new FormData();
  formData.append('photo', photoFile);

  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/provider/photo`, {
    method: 'POST',
    headers,
    body: formData
  });
  
  if (!res.ok) {
    throw new Error('Failed to upload photo');
  }
  
  return res.json();
};

export const getProviderJobs = async () => {
  const res = await fetch(`${API_URL}/provider/jobs`, {
    headers: getHeaders()
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch provider jobs');
  }
  
  return res.json();
};

export const postJobUpdate = async (jobId, { message, imageUrl, file } = {}) => {
  // If a file is provided, send multipart/form-data
  if (file) {
    const fd = new FormData();
    if (message) fd.append('message', message);
    fd.append('image', file);

    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/provider/jobs/${jobId}/updates`, {
      method: 'POST',
      headers,
      body: fd
    });

    if (!res.ok) throw new Error('Failed to post job update with file');
    return res.json();
  }

  const res = await fetch(`${API_URL}/provider/jobs/${jobId}/updates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message, imageUrl })
  });

  if (!res.ok) throw new Error('Failed to post job update');
  return res.json();
};

export const getMyJobs = async () => {
  const res = await fetch(`${API_URL}/provider/my-jobs`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch my jobs');
  return res.json();
};

export const getNotifications = async () => {
  const res = await fetch(`${API_URL}/notifications`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
};

export const markNotificationRead = async (id) => {
  const res = await fetch(`${API_URL}/notifications/${id}/read`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to mark notification read');
  return res.json();
};

export const createInvoice = async ({ serviceRequestId, amount, currency = 'USD', notes = '' }) => {
  const res = await fetch(`${API_URL}/invoices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serviceRequestId, amount, currency, notes })
  });
  if (!res.ok) {
    // try to parse JSON error body, otherwise read text
    let body;
    try {
      body = await res.json();
    } catch (e) {
      try { body = { text: await res.text() }; } catch (e2) { body = { text: 'Unknown server response' }; }
    }
    const message = (body && (body.error || body.message)) || body.text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
};

export const debugPayInvoice = async (invoiceId) => {
  const API_URL_BASE = API_URL;
  // If the backend debug endpoint is enabled, call it to mark invoice paid for local testing.
  const secret = process.env.REACT_APP_INVOICE_DEBUG_SECRET;
  const qs = secret ? `?secret=${encodeURIComponent(secret)}` : '';
  const res = await fetch(`${API_URL_BASE}/debug/pay-invoice/${invoiceId}${qs}`, {
    method: 'GET'
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Debug pay failed (HTTP ${res.status})`);
  }
  return res.json();
};

export const getInvoices = async () => {
  const res = await fetch(`${API_URL}/invoices`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
};

export const updateRequest = async (requestId, payload) => {
  const res = await fetch(`${API_URL}/service-requests/${requestId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(body.error || `Failed to update request (HTTP ${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
};

export const markInvoicePaid = async (id) => {
  const res = await fetch(`${API_URL}/invoices/${id}/pay`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to mark invoice paid');
  }
  return res.json();
};

export const createInvoiceCheckout = async (invoiceId) => {
  const clientOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const res = await fetch(`${API_URL}/invoices/${invoiceId}/create-checkout`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clientOrigin })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Failed to create checkout');
    err.status = res.status;
    throw err;
  }

  return res.json();
};

export const addRequestAttachments = async (requestId, files) => {
  if (!Array.isArray(files) || files.length === 0) return { attachments: [] };
  const fd = new FormData();
  files.forEach((file) => fd.append('attachments', file));

  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/service-requests/${requestId}/attachments`, {
    method: 'POST',
    headers,
    body: fd
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Failed to upload attachments');
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.json();
};

export const deleteRequestAttachment = async (requestId, attachmentId) => {
  const res = await fetch(`${API_URL}/service-requests/${requestId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Failed to delete attachment');
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.json();
};

export const getProviderEarnings = async () => {
  const res = await fetch(`${API_URL}/provider/earnings`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load earnings');
  }
  return res.json();
};

export const getPlatformFee = async () => {
  const res = await fetch(`${API_URL}/admin/platform-fee`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load platform fee');
  }
  return res.json();
};

export const updatePlatformFee = async (percent) => {
  const res = await fetch(`${API_URL}/admin/platform-fee`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ percent })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update platform fee');
  }
  return res.json();
};

/*
 NOTE (PAY NOT WORKING):
 - The `createInvoiceCheckout` endpoint delegates to Stripe when configured. Locally, Stripe
   checkout may fail (redirects blocked, CORS, missing webhook). For local demos we rely on
   the backend returning `{ debugUrl }` when `INVOICE_DEBUG_ENABLED=true`. The frontend
   handles `debugUrl` by copying to clipboard and prompting the user to open it.
 - If customer/provider report that Pay/Get Pay Link does not work, ensure the backend has
   `INVOICE_DEBUG_ENABLED=true` OR configure Stripe env vars (`STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`).
*/
