import { useEffect, useState } from "react";
import styles from "./AdminDashboard.module.css";

const API_BASE = "http://localhost:8081";

function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  // Modal management
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);
  const [logoutVisible, setLogoutVisible] = useState(false);

  // Suspension duration
  const [suspendDuration, setSuspendDuration] = useState("24");
  // Role filter (Customer, Provider)
  const [roleFilter, setRoleFilter] = useState("all");
  // Status filter (Active, Pending, Suspended, Banned)
  const [statusFilter, setStatusFilter] = useState("all");

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setError("Missing token");
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const headers = { Authorization: `Bearer ${token}` };

        const [summaryRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/admin/summary`, { headers }),
          fetch(`${API_BASE}/admin/users`, { headers }),
        ]);

        if (summaryRes.status === 401 || usersRes.status === 401)
          throw new Error("Unauthorized");

        if (!summaryRes.ok) throw new Error("Failed to load summary");
        if (!usersRes.ok) throw new Error("Failed to load users");

        const summaryData = await summaryRes.json();
        const usersData = await usersRes.json();

        setSummary(summaryData);
        setUsers(usersData);
      } catch (err) {
        console.error("Failed to load admin data", err);
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  function confirmLogout() {
    setLogoutVisible(true);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function openConfirmModal(user, action) {
    setConfirmUser(user);
    setConfirmAction(action);
    setConfirmVisible(true);
    if (action === "suspend") setSuspendDuration("24");
  }

  function closeConfirmModal() {
    setConfirmVisible(false);
    setConfirmUser(null);
    setConfirmAction(null);
  }

  // Handles the approval of a provider.
  async function handleApprove(userId) {
    if (!token) return;

    try {
      setActioningId(userId);
      setError(null);

      const res = await fetch(`${API_BASE}/admin/users/${userId}/approve`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to approve user");
      }

      // On successful approval, update the user to "Active" status.
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, status: "active" } : u
      ));
    } catch (err) {
      console.error("Failed to approve user", err);
      setError(err.message || "Failed to approve user");
    } finally {
      setActioningId(null);
    }
  }

  async function handleConfirmedAction() {
    if (!token || !confirmUser || !confirmAction) return;

    try {
      setActioningId(confirmUser.id);
      setError(null);

      const method = confirmAction === "delete" ? "DELETE" : "POST";
      const url =
        confirmAction === "delete"
          ? `${API_BASE}/admin/users/${confirmUser.id}`
          : `${API_BASE}/admin/users/${confirmUser.id}/${confirmAction}`;

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const body =
        confirmAction === "suspend"
          ? JSON.stringify({ duration: suspendDuration })
          : undefined;

      const res = await fetch(url, { method, headers, body });

      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${confirmAction} user`);
      }

      if (confirmAction === "delete") {
        setUsers((prev) => prev.filter((u) => u.id !== confirmUser.id));
      } else {
        const updatedUser = await res.json().catch(() => null);
        if (updatedUser) {
          setUsers((prev) =>
            prev.map((u) => (u.id === confirmUser.id ? { ...u, ...updatedUser } : u))
          );
        }
      }
    } catch (err) {
      console.error(`Failed to ${confirmAction} user`, err);
      setError(err.message || `Failed to ${confirmAction} user`);
    } finally {
      setActioningId(null);
      closeConfirmModal();
    }
  }

  function Modal({
    visible,
    title,
    color,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    showDuration,
    durationValue,
    setDurationValue,
  }) {
    const overlayClass = `${styles.modalOverlay} ${
      visible ? styles.modalOverlayVisible : ""
    }`;
    const contentClass = `${styles.modalContent} ${
      visible ? styles.modalContentVisible : ""
    }`;

    return (
      <div className={overlayClass}>
        <div className={contentClass} style={{ "--modal-accent": color }}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <p className={styles.modalMessage}>{message}</p>
          {showDuration && (
            <div className={styles.modalDuration}>
              <label className={styles.modalDurationLabel}>Suspension Duration:</label>
              <select
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className={styles.modalDurationSelect}
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
              </select>
            </div>
          )}
          <div className={styles.modalActions}>
            <button
              onClick={onConfirm}
              className={`${styles.modalButton} ${styles.modalConfirm}`}
            >
              {confirmLabel || "Confirm"}
            </button>
            <button
              onClick={onCancel}
              className={`${styles.modalButton} ${styles.modalCancel}`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function getActionDetails(action) {
    const map = {
      suspend: { color: "#ff9800", label: "Suspend User" },
      ban: { color: "#9c27b0", label: "Ban User" },
      activate: { color: "#388e3c", label: "Reactivate User" },
      delete: { color: "#d32f2f", label: "Delete User" },
    };
    return map[action] || { color: "#555", label: "Confirm Action" };
  }

  // 🧠 Format Suspended Until as MM/DD/YYYY
  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date)) return "—";
    return date.toLocaleDateString("en-US"); // MM/DD/YYYY
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Dashboard</h1>
      <div className={styles.logoutWrap}>
        <button onClick={confirmLogout} className={styles.logoutButton}>
          Log Out
        </button>
      </div>

      {loading && <p className={styles.stateMessage}>Loading...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <>
          {summary && summary.stats && (
            <section className={styles.summarySection}>
              <div className={styles.summaryGrid}>
                {Object.entries(summary.stats).map(([label, value]) => (
                  <div key={label} className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>{label}</div>
                    <div className={styles.summaryValue}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.usersSection}>
            <h2 className={styles.sectionTitle}>Users</h2>

	          {/* Filters: Role & Status */}
	          <div
  	          style={{
    		        display: "flex",
    		        justifyContent: "flex-end",
    		        gap: "12px",
    		        marginBottom: "10px",
    		        marginRight: "20px",
  	          }}
	          >
  	          {/* Role Filter */}
  	          <select
    		        value={roleFilter}
    		        onChange={(e) => setRoleFilter(e.target.value)}
    		        style={{
      		        padding: "6px 10px",
      		        borderRadius: "5px",
      		        border: "1px solid #ccc",
      		        fontSize: "0.9rem",
    		        }}
  	          >
    		        <option value="all">All Roles</option>
    		        <option value="customer">Customer</option>
    		        <option value="provider">Provider</option>
  	          </select>

  	          {/* Status Filter */}
  	          <select
    		        value={statusFilter}
    		        onChange={(e) => setStatusFilter(e.target.value)}
    		        style={{
      		        padding: "6px 10px",
      		        borderRadius: "5px",
      		        border: "1px solid #ccc",
      		        fontSize: "0.9rem",
    		        }}
  	          >
    		        <option value="all">All Statuses</option>
    		        <option value="active">Active</option>
    		        <option value="pending">Pending</option>
    		        <option value="suspended">Suspended</option>
    		        <option value="banned">Banned</option>
  	          </select>
	          </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    {["ID", "Name", "Email", "Role", "Status", "Suspended Until", "Actions"].map(
                      (th) => (
                        <th key={th} className={styles.tableHeader}>
                          {th}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.filter((user) => {
                    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    		            const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    		            return matchesRole && matchesStatus;
		              }).map((user) => {
                    const isActive = user.status === "active" || !user.status;
                    const isSuspended = user.status === "suspended";
                    const isBanned = user.status === "banned";
                    const isPending = user.status === "pending";
                    const statusClass = isBanned
                      ? styles.statusBanned
                      : isSuspended
                      ? styles.statusSuspended
                      : styles.statusActive;

                    return (
                      <tr key={user.id}>
                        <td className={`${styles.tableCell} ${styles.idCell}`}>{user.id}</td>
                        <td className={`${styles.tableCell} ${styles.nameCell}`}>
                          {user.name || "-"}
                        </td>
                        <td className={`${styles.tableCell} ${styles.emailCell}`}>{user.email}</td>
                        <td className={`${styles.tableCell} ${styles.roleCell}`}>{user.role}</td>
                        <td
                          className={`${styles.tableCell} ${styles.statusCell} ${statusClass}`}
                        >
                          {user.status || "active"}
                        </td>
                        <td className={`${styles.tableCell} ${styles.suspendedCell}`}>
                          {formatDate(user.suspended_until)}
                        </td>
                        <td className={`${styles.tableCell} ${styles.actionCell}`}>
                          <div className={styles.actionGroup}>
                            {isActive && (
                              <>
                                <button
                                  onClick={() => openConfirmModal(user, "suspend")}
                                  className={`${styles.actionButton} ${styles.suspendButton}`}
                                >
                                  Suspend
                                </button>
                                <button
                                  onClick={() => openConfirmModal(user, "ban")}
                                  className={`${styles.actionButton} ${styles.banButton}`}
                                >
                                  Ban
                                </button>
                              </>
                            )}
                            {/* Show the approve button only for users with a 'pending' status. */}
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApprove(user.id)}
                                  className={`${styles.actionButton} ${styles.approveButton}`}
                                >
                                  Approve
                                </button>
                              </>
                            )}
                            {isSuspended && (
                              <>
                                <button
                                  onClick={() => openConfirmModal(user, "activate")}
                                  className={`${styles.actionButton} ${styles.activateButton}`}
                                >
                                  Reactivate
                                </button>
                                <button
                                  onClick={() => openConfirmModal(user, "ban")}
                                  className={`${styles.actionButton} ${styles.banButton}`}
                                >
                                  Ban
                                </button>
                              </>
                            )}
                            {isBanned && (
                              <button
                                onClick={() => openConfirmModal(user, "activate")}
                                className={`${styles.actionButton} ${styles.activateButton}`}
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              onClick={() => openConfirmModal(user, "delete")}
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {users.filter((user) => {
		                const matchesRole = roleFilter === "all" || user.role === roleFilter;
  		              const matchesStatus = statusFilter === "all" || user.status === statusFilter;
  		              return matchesRole && matchesStatus;
		              }).length === 0 && (
  		              <tr>
    		              <td colSpan="7" style={{ textAlign: "center", padding: "10px" }}>
      			            No users found for the selected filters.
    		              </td>
  		              </tr>
		              )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Modal
        visible={confirmVisible}
        title={getActionDetails(confirmAction).label}
        color={getActionDetails(confirmAction).color}
        message={`Are you sure you want to ${confirmAction} ${
          confirmUser?.name || confirmUser?.email
        }?`}
        onConfirm={handleConfirmedAction}
        onCancel={closeConfirmModal}
        confirmLabel={`Yes, ${getActionDetails(confirmAction).label.split(" ")[0]}`}
        showDuration={confirmAction === "suspend"}
        durationValue={suspendDuration}
        setDurationValue={setSuspendDuration}
      />

      <Modal
        visible={logoutVisible}
        title="Confirm Logout"
        color="#555"
        message="Are you sure you want to log out of the admin dashboard?"
        onConfirm={handleLogout}
        onCancel={() => setLogoutVisible(false)}
        confirmLabel="Log Out"
      />
    </div>
  );
}

export default AdminDashboard;
