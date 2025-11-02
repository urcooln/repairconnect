// src/services/api.js
const API_URL = "http://localhost:8081"; // Test backend server port

// Helper to attach auth headers
function getHeaders() {
  const token = localStorage.getItem('token');
  console.log('Sending token:', token); // ✅ Add this line
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
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

  const res = await fetch(`${API_URL}/provider/photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  });
  
  if (!res.ok) {
    throw new Error('Failed to upload photo');
  }
  
  return res.json();
};

export const getProviderJobs = async () => {
  const res = await fetch(`${API_URL}/provider/jobs`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch provider jobs');
  }
  
  return res.json();
};
