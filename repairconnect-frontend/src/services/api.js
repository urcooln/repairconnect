// src/services/api.js
const API_URL = "https://your-backend.onrender.com";

export async function getRequests() {
  const res = await fetch(`${API_URL}/requests`);
  return res.json();
}

export async function createRequest(data) {
  const res = await fetch(`${API_URL}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
