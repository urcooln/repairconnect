import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8081"; 

// For debugging
const testConnection = async () => {
  try {
    const res = await fetch(`${API_BASE}/db-check`);
    const data = await res.json();
    console.log('Test connection successful:', data);
  } catch (error) {
    console.error('Test connection failed:', error);
  }
};

// Test the connection when the component loads
setTimeout(testConnection, 1000);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // Save token
      localStorage.setItem("token", data.token);

      // Navigate to provider dashboard
      navigate("/provider/dashboard");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <h2>Customer/Provider Login</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Login</button>
    </form>
  );
}
