// src/pages/Home.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import jwtDecode from "jwt-decode";
import styles from "./Home.module.css";

const API_BASE = "http://localhost:8081";

function Home() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // ✅ LOGIN
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

      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);

<<<<<<< HEAD
      // Fallback: customer/provider
      res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      data = await res.json();

      if (res.ok) {
        localStorage.setItem("rc_token", data.token);

  const decoded = jwtDecode(data.token);
        console.log("Decoded token:", decoded);
=======
        try {
          const decoded = jwtDecode(data.token);
          console.log("Decoded token:", decoded);
          
          // Navigate based on role
          if (decoded.role === 'provider') {
            return navigate('/provider/dashboard');
          } else if (decoded.role === 'customer') {
            return navigate('/customer/dashboard');
          } else if (decoded.role === 'admin') {
            return navigate('/admin/dashboard');
          } else {
            throw new Error('Invalid role');
          }
        } catch (error) {
          console.error('Token decode error:', error);
          setError('Invalid login response');
          localStorage.removeItem('token');
        }
>>>>>>> 295e417 (I changed the back end port for the Provider dashboard to '8081' due to communication conflicts to the front end. I also formatted the front end to display a sample of the provider dashboard featureing: User profile Photo handleing, role handleing, job listing, and a way to filter jobs by provider roles selected. As a reminder most of the front end page buttons arent built in the back end yet these changes are being pushed for demonstration purposes.)

      }

      throw new Error(data.error || "Login failed");
    } catch (e) {
      setError(e.message);
    }
  }

  // ✅ REGISTER
  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Registration failed");

      // After register → back to login form
      setIsRegistering(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("customer");
      console.log({ name, email, password, role });
    } catch (e) {
      setError(e.message);
    }
  }

  // ✅ RESET PASSWORD
  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, newPassword }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g., HTML 404); handled below with fallback message.
      }

      if (!res.ok) {
        throw new Error(data?.error || "Please type a valid email.");
      }

      setResetSuccess("Password successfully reset. You can now log in.");
      setTimeout(() => setShowResetModal(false), 2000);
    } catch (err) {
      setResetError(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Welcome to <span className={styles.brand}>RepairConnect</span>
      </h1>
      <p className={styles.slogan}>Repair smarter. Connect faster.</p>

      {isRegistering ? (
        <>
          <p className={styles.subtitle}>Register</p>
          <form className={styles.form} onSubmit={handleRegister}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="role">
                Role
              </label>
              <select
                id="role"
                className={styles.input}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="customer">Customer</option>
                <option value="provider">Provider</option>
              </select>
            </div>

            <button className={styles.submitButton} type="submit">
              Register
            </button>
          </form>

          <p>
            Already have an account?{" "}
            <button
              className={styles.linkButton}
              type="button"
              onClick={() => setIsRegistering(false)}
            >
              Sign In
            </button>
          </p>
        </>
      ) : (
        <>
          <p className={styles.subtitle}>Sign-in</p>
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className={styles.submitButton} type="submit">
              Sign In
            </button>
          </form>

          {/* ✅ Forgot Password link */}
          <p
            style={{
              color: "#007bff",
              cursor: "pointer",
              textDecoration: "underline",
              marginTop: "10px",
            }}
            onClick={() => setShowResetModal(true)}
          >
            Forgot Password?
          </p>

          <p>
            Don’t have an account?{" "}
            <button
              className={styles.linkButton}
              type="button"
              onClick={() => setIsRegistering(true)}
            >
              Register
            </button>
          </p>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {/* ✅ Reset Password Modal */}
      {showResetModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Reset Password</h2>

            {resetError && <p className={styles.error}>{resetError}</p>}
            {resetSuccess && <p className={styles.success}>{resetSuccess}</p>}

            <form onSubmit={handleResetPassword}>
              <input
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className={styles.modalInput}
              />

              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={styles.modalInput}
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.modalInput}
              />

              <button type="submit" className={styles.modalButtonPrimary}>
                Reset Password
              </button>
            </form>

            <button
              onClick={() => setShowResetModal(false)}
              className={styles.modalButtonSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
