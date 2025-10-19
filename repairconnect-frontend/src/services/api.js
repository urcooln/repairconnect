// src/services/api.js
const API_URL = "http://localhost:8080";

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

export async function getMyProfile() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch profile");
  }
  return res.json();
}
