import { useState, useEffect } from "react";
import styles from "./AdminDashboard.module.css";

const API_BASE = "http://localhost:8081";

function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState({});

  //Modal management
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const token = localStorage.getItem("token");

  // ✅ Fetch service requests from backend
  useEffect(() => {
    if (!token) return;

    async function fetchRequests() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/admin/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch service requests");
        const data = await res.json();
        setRequests(data);
        // initialize selected statuses map
        const map = {};
        data.forEach((r) => (map[r.id] = r.status || 'pending'));
        setSelectedStatuses(map);
      } catch (err) {
        console.error("Error fetching service requests:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [token]);

  function confirmLogout() {
    setLogoutVisible(true);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  // ✅ Open delete confirmation modal
  function confirmDelete(request) {
    setSelectedRequest(request);
    setDeleteVisible(true);
  }

  // ✅ Handle Delete Request
  async function handleDeleteRequest() {
    if (!token || !selectedRequest) return;

    try {
      setActioningId(selectedRequest.id);

      const res = await fetch(`${API_BASE}/admin/requests/${selectedRequest.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete request");

      // Remove from local list
      setRequests((prev) => prev.filter((req) => req.id !== selectedRequest.id));
    } catch (err) {
      console.error("Failed to delete request:", err);
      setError(err.message || "Failed to delete request");
    } finally {
      setActioningId(null);
      setDeleteVisible(false);
      setSelectedRequest(null);
    }
  }

  async function handleChangeStatus(requestId) {
    const token = localStorage.getItem('token');
    const status = selectedStatuses[requestId];
    if (!token || !status) return;
    try {
      setActioningId(requestId);
      const res = await fetch(`${API_BASE}/jobs/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to change status');
      }
      // refresh list
      const refreshed = await fetch(`${API_BASE}/admin/requests`, { headers: { Authorization: `Bearer ${token}` } });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setRequests(data);
        const map = {};
        data.forEach((r) => (map[r.id] = r.status || 'pending'));
        setSelectedStatuses(map);
      }
    } catch (err) {
      console.error('Failed to change status:', err);
      setError(err.message || 'Failed to change status');
    } finally {
      setActioningId(null);
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

  return (
    <div className={styles.container}>
      {/* Header section */}
      <h1 className={styles.title}>Service Requests</h1>
      <div className={styles.logoutWrap}>
        <button
          onClick={() => (window.location.href = "/admin/dashboard")}
          className={styles.navButton}
        >
          Back to Dashboard
        </button>
        <button onClick={confirmLogout} className={styles.logoutButton}>
          Log Out
        </button>
      </div>

      {loading && <p className={styles.stateMessage}>Loading...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <section className={styles.usersSection}>
          <h2 className={styles.sectionTitle}>All Service Requests</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  {["ID", "Created By", "Request", "Category", "Description", "Status", "Actions"].map(
                    (th) => (
                      <th key={th} className={styles.tableHeader}>
                        {th}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td className={`${styles.tableCell} ${styles.idCell}`}>{req.id}</td>
                      <td className={`${styles.tableCell} ${styles.nameCell}`}>
                        {req.customer_name || "Database"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.titleCell}`}>
                        {req.title || "—"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.roleCell}`}>
			                  {req.category || "—"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.descriptionCell}`}>
                        {req.description || "—"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.statusCell}`}>
                        {req.status || "—"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.actionCell}`}>
                        <div className={styles.actionGroup}>
                          <select
                            value={selectedStatuses[req.id] || (req.status || 'pending')}
                            onChange={(e) => setSelectedStatuses((s) => ({ ...s, [req.id]: e.target.value }))}
                            disabled={actioningId === req.id}
                            style={{ marginRight: 8, padding: '6px 8px', borderRadius: 6 }}
                          >
                            {['pending','taken','ongoing','paused','done','cancelled'].map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleChangeStatus(req.id)}
                            disabled={actioningId === req.id}
                            className={`${styles.actionButton} ${styles.primaryButton}`}
                            style={{ marginRight: 8 }}
                          >
                            {actioningId === req.id ? 'Working...' : 'Apply'}
                          </button>

                          <button
                            onClick={() => confirmDelete(req)}
                            disabled={actioningId === req.id}
                            className={`${styles.actionButton} ${styles.deleteButton}`}
                          >
                            {actioningId === req.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "10px" }}>
                      No service requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Delete Modal */}
      <Modal
        visible={deleteVisible}
        title="Delete Request"
        color="#d32f2f"
        message={
          selectedRequest
            ? `Are you sure you want to delete the request "${selectedRequest.title || "Untitled"}"?`
            : "Are you sure you want to delete this request?"
        }
        onConfirm={handleDeleteRequest}
        onCancel={() => setDeleteVisible(false)}
        confirmLabel="Delete"
      />

      {/* Logout Modal */}
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

export default AdminRequests;
