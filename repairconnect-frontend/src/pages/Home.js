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

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

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

        try {
          const decoded = jwtDecode(data.token);
          if (decoded.role === "provider") {
            return navigate("/provider/dashboard");
          }
          if (decoded.role === "customer") {
            return navigate("/customer/dashboard");
          }
          if (decoded.role === "admin") {
            return navigate("/admin/dashboard");
          }
          throw new Error("Invalid role");
        } catch (err) {
          console.error("Token decode error:", err);
          setError("Invalid login response");
          localStorage.removeItem("token");
          return;
        }
      }

      throw new Error(data.error || "Login failed");
    } catch (err) {
      setError(err.message);
    }
  }

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

      setIsRegistering(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("customer");
    } catch (err) {
      setError(err.message);
    }
  }

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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password reset failed.");

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
                required
              >
                <option value="customer">Customer</option>
                <option value="provider">Provider</option>
              </select>
            </div>

            <button className={styles.submitButton} type="submit">
              Register
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setIsRegistering(false)}
            >
              Back to login
            </button>
          </form>
        </>
      ) : (
        <>
          <p className={styles.subtitle}>Login</p>
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.submitButton} type="submit">
              Login
            </button>
          </form>

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

      {showResetModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Reset Password</h2>
            {resetError && <p className={styles.error}>{resetError}</p>}
            {resetSuccess && <p className={styles.success}>{resetSuccess}</p>}
            <form onSubmit={handleResetPassword}>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  className={styles.input}
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  className={styles.input}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button className={styles.submitButton} type="submit">
                  Reset Password
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
