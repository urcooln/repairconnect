import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8080";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer"); // Add role state, default to 'customer'
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }), // Send role to backend
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      navigate("/");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <form onSubmit={handleRegister}>
      <h2>Register as Customer/Provider</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="customer">Customer</option>
        <option value="provider">Provider</option>
      </select>
      <button type="submit">Register</button>
    </form>
  );
}
