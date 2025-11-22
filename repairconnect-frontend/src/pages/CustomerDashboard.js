import { useState, useEffect } from "react";
import Notifications from '../components/Notifications';
import InvoiceCenter from '../components/InvoiceCenter';
import { createInvoiceCheckout, markInvoicePaid } from '../services/api';
import { useNavigate } from "react-router-dom";
import jwtDecode from "jwt-decode";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8081";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  
  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  // Requests list state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState('');

  const categories = [
    "Plumbing",
    "Electrical",
    "HVAC",
    "Carpentry",
    "Appliance Repair",
    "Painting",
    "Landscaping",
    "Roofing",
    "Other"
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserName(decoded.email);
      } catch (err) {
        console.error("Invalid token:", err);
      }
    }
    loadRequests();
    // load profile basic info
    // don't block the dashboard load
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/customer/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfileFirstName(data.firstName || '');
          setProfileLastName(data.lastName || '');
          setProfilePhone(data.phone || '');
          setProfileEmail(data.email || '');
          setProfileAddress(data.address || '');
          setProfilePhoto(data.photoUrl || null);
        }
      } catch (err) {
        // ignore silently
      }
    })();
  }, []);

  useEffect(() => {
    if (activeSection === 'payment-history') fetchInvoices();
  }, [activeSection]);

  async function loadRequests() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/service-requests/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Error loading requests:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!title.trim() || !category || !description.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/service-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim(),
          preferred_date: preferredDate || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Service request submitted successfully!");
        setTitle("");
        setCategory("");
        setDescription("");
        setPreferredDate("");
        loadRequests();
      } else {
        setError(data.error || "Failed to submit request");
      }
    } catch (err) {
      setError("Error submitting request. Please try again.");
      console.error(err);
    }
  }

  async function handleCancel(requestId) {
    if (!window.confirm("Are you sure you want to cancel this request?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/service-requests/${requestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage("Request cancelled successfully");
        loadRequests();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to cancel request");
      }
    } catch (err) {
      setError("Error cancelling request");
      console.error(err);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  const menuItems = [
    { id: "overview", label: "Overview", icon: "📊", active: true },
    { id: "submit", label: "Submit Request", icon: "➕", active: true },
    { id: "my-requests", label: "My Requests", icon: "📋", active: true },
    { id: "browse-providers", label: "Browse Providers", icon: "🔍", active: true },
    { id: "payment-history", label: "Payment History", icon: "💳", active: false },
    { id: "profile", label: "Profile Settings", icon: "⚙️", active: true }
  ];

  // browse providers state
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerQuery, setProviderQuery] = useState('');

  // fetch providers helper
  const fetchProviders = async (q = '') => {
    setProvidersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE}/providers${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.error('Failed to load providers', await res.text());
        setProviders([]);
        return;
      }
      const data = await res.json();
      setProviders(data);
    } catch (err) {
      console.error('Failed to load providers', err);
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  };

  // Payment history (invoices)
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/invoices`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load invoices', err);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handlePay = async (invoiceId) => {
    if (!window.confirm('Proceed to pay this invoice?')) return;
    try {
      const data = await createInvoiceCheckout(invoiceId);
      if (data && data.url) {
        // redirect to Stripe Checkout
        window.location.href = data.url;
        return;
      }

      if (data && data.debugUrl) {
        try { await navigator.clipboard.writeText(data.debugUrl); } catch (e) {}
        const openNow = window.confirm('Stripe not configured locally — debug pay link copied. Open it now to mark the invoice paid?');
        if (openNow) window.open(data.debugUrl, '_blank');
        // refresh list after short delay
        setTimeout(() => fetchInvoices(), 800);
        return;
      }

      // if no URL returned, fallback to marking as paid locally
      if (window.confirm('No checkout URL returned. Mark invoice as paid locally?')) {
        await markInvoicePaid(invoiceId);
        await fetchInvoices();
        alert('Invoice marked as paid — provider notified');
      }
    } catch (err) {
      console.error('Payment failed or Stripe not available', err);
      if (err && (err.status === 501 || /stripe/i.test(err.message || ''))) {
        if (window.confirm('Stripe is not configured. Mark invoice as paid locally instead?')) {
          try {
            await markInvoicePaid(invoiceId);
            await fetchInvoices();
            alert('Invoice marked as paid — provider notified');
          } catch (e) {
            alert(e.message || 'Failed to mark invoice paid');
          }
        }
      } else {
        alert(err.message || 'Payment attempt failed');
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f0f2f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      
      {/* Sidebar Navigation */}
      <div style={{
        width: "280px",
        background: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)",
        color: "white",
        padding: "0",
        position: "fixed",
        height: "100vh",
        overflowY: "auto",
        boxShadow: "4px 0 12px rgba(0,0,0,0.15)"
      }}>
        <div style={{ padding: "30px 20px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700", letterSpacing: "-0.5px" }}>
            RepairConnect
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis" }}>
            {userName}
          </p>
        </div>

        <nav style={{ padding: "20px 15px" }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.active && setActiveSection(item.id)}
              disabled={!item.active}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "14px 16px",
                marginBottom: "8px",
                backgroundColor: activeSection === item.id ? "rgba(255,255,255,0.15)" : "transparent",
                color: item.active ? "white" : "rgba(255,255,255,0.4)",
                border: activeSection === item.id ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                borderRadius: "10px",
                textAlign: "left",
                cursor: item.active ? "pointer" : "not-allowed",
                fontSize: "15px",
                fontWeight: activeSection === item.id ? "600" : "500",
                transition: "all 0.2s ease",
                transform: activeSection === item.id ? "translateX(2px)" : "none"
              }}
              onMouseEnter={(e) => {
                if (item.active && activeSection !== item.id) {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== item.id) {
                  e.target.style.backgroundColor = "transparent";
                }
              }}
            >
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span>{item.label}</span>
              {!item.active && <span style={{ marginLeft: "auto", fontSize: "14px" }}>🔒</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: "0 15px 30px 15px", marginTop: "auto" }}>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              padding: "14px",
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "rgba(220, 38, 38, 1)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ marginLeft: "280px", flex: 1, padding: "40px 50px", minHeight: "100vh" }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
          <Notifications />
          <InvoiceCenter />
        </div>
        
        {/* Overview Section */}
        {activeSection === "overview" && (
          <div>
            <h1 style={{ margin: "0 0 30px 0", fontSize: "32px", fontWeight: "700", color: "#1f2937" }}>
              Dashboard Overview
            </h1>
            
            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginBottom: "40px" }}>
              <div style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                padding: "28px",
                borderRadius: "16px",
                boxShadow: "0 4px 20px rgba(59, 130, 246, 0.3)",
                color: "white",
                transition: "transform 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>📋</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", opacity: 0.9 }}>Active Requests</h3>
                </div>
                <p style={{ fontSize: "42px", margin: 0, fontWeight: "700" }}>
                  {requests.filter(r => r.status === "pending").length}
                </p>
              </div>

              <div style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                padding: "28px",
                borderRadius: "16px",
                boxShadow: "0 4px 20px rgba(16, 185, 129, 0.3)",
                color: "white",
                transition: "transform 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>✅</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", opacity: 0.9 }}>Completed</h3>
                </div>
                <p style={{ fontSize: "42px", margin: 0, fontWeight: "700" }}>
                  {requests.filter(r => r.status === "completed").length}
                </p>
              </div>

              <div style={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                padding: "28px",
                borderRadius: "16px",
                boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
                color: "white",
                transition: "transform 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>📊</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", opacity: 0.9 }}>Total Requests</h3>
                </div>
                <p style={{ fontSize: "42px", margin: 0, fontWeight: "700" }}>
                  {requests.length}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              backgroundColor: "white",
              padding: "32px",
              borderRadius: "16px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
              <h2 style={{ margin: "0 0 24px 0", fontSize: "22px", fontWeight: "700", color: "#1f2937" }}>
                Quick Actions
              </h2>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setActiveSection("submit")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "16px 28px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>➕</span>
                  <span>New Request</span>
                </button>
                <button
                  onClick={() => setActiveSection("my-requests")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "16px 28px",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#e5e7eb";
                    e.target.style.borderColor = "#d1d5db";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "#f3f4f6";
                    e.target.style.borderColor = "#e5e7eb";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>📋</span>
                  <span>View Requests</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Request Section */}
        {activeSection === "submit" && (
          <div>
            <h1 style={{ margin: "0 0 30px 0", fontSize: "32px", fontWeight: "700", color: "#1f2937" }}>
              Submit a Service Request
            </h1>
            
            <div style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "16px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#374151", fontSize: "15px" }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Brief summary, e.g., 'Broken AC unit'"
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      fontSize: "16px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      color: "#374151",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.backgroundColor = "white";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.backgroundColor = "#f9fafb";
                    }}
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#374151", fontSize: "15px" }}>
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      fontSize: "16px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      color: "#374151",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.backgroundColor = "white";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.backgroundColor = "#f9fafb";
                    }}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#374151", fontSize: "15px" }}>
                    Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows="6"
                    placeholder="Please describe the issue in detail..."
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      fontSize: "16px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      color: "#374151",
                      resize: "vertical",
                      fontFamily: "inherit",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.backgroundColor = "white";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.backgroundColor = "#f9fafb";
                    }}
                  />
                </div>

                <div style={{ marginBottom: "28px" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#374151", fontSize: "15px" }}>
                    Preferred Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      fontSize: "16px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      color: "#374151",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.backgroundColor = "white";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.backgroundColor = "#f9fafb";
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "17px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                >
                  Submit Request
                </button>
              </form>

              {message && (
                <div style={{
                  marginTop: "24px",
                  padding: "16px 20px",
                  backgroundColor: "#d1fae5",
                  color: "#065f46",
                  borderRadius: "12px",
                  border: "1px solid #a7f3d0",
                  fontSize: "15px",
                  fontWeight: "500"
                }}>
                  {message}
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: "24px",
                  padding: "16px 20px",
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "12px",
                  border: "1px solid #fecaca",
                  fontSize: "15px",
                  fontWeight: "500"
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Requests Section */}
        {activeSection === "my-requests" && (
          <div>
            <h1 style={{ margin: "0 0 30px 0", fontSize: "32px", fontWeight: "700", color: "#1f2937" }}>
              My Requests
            </h1>
            
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", backgroundColor: "white", borderRadius: "16px" }}>
                <p style={{ fontSize: "18px", color: "#6b7280" }}>Loading...</p>
              </div>
            ) : requests.length === 0 ? (
              <div style={{
                backgroundColor: "white",
                padding: "60px",
                borderRadius: "16px",
                textAlign: "center",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
              }}>
                <div style={{ fontSize: "64px", marginBottom: "20px" }}>📋</div>
                <p style={{ color: "#6b7280", fontSize: "18px", marginBottom: "24px" }}>
                  You haven't submitted any requests yet.
                </p>
                <button
                  onClick={() => setActiveSection("submit")}
                  style={{
                    padding: "14px 32px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                >
                  Submit Your First Request
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "20px" }}>
                {requests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      backgroundColor: "white",
                      padding: "28px",
                      borderRadius: "16px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: "0 0 12px 0", color: "#1f2937", fontSize: "22px", fontWeight: "700" }}>
                          {req.title || req.category}
                        </h3>
                        <p style={{ margin: "0 0 6px 0", color: "#6b7280", fontSize: "14px" }}>
                          <strong style={{ color: "#374151" }}>Category:</strong> {req.category}
                        </p>
                        <p style={{ margin: "0 0 16px 0", color: "#6b7280", lineHeight: "1.6", fontSize: "15px" }}>
                          {req.description}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "14px", color: "#9ca3af" }}>
                          <div>
                            <strong style={{ color: "#374151" }}>Status:</strong>{" "}
                            <span style={{
                              padding: "5px 12px",
                              borderRadius: "8px",
                              backgroundColor: req.status === "pending" ? "#fef3c7" : 
                                             req.status === "completed" ? "#d1fae5" : "#e5e7eb",
                              color: req.status === "pending" ? "#92400e" :
                                     req.status === "completed" ? "#065f46" : "#374151",
                              fontSize: "13px",
                              fontWeight: "600"
                            }}>
                              {req.status.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <strong style={{ color: "#374151" }}>Created:</strong> {new Date(req.created_at).toLocaleString()}
                          </div>
                          {req.preferred_date && (
                            <div>
                              <strong style={{ color: "#374151" }}>Preferred:</strong> {new Date(req.preferred_date).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          style={{
                            padding: "10px 20px",
                            backgroundColor: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            marginLeft: "24px",
                            fontSize: "14px",
                            fontWeight: "600",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = "#dc2626";
                            e.target.style.transform = "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "#ef4444";
                            e.target.style.transform = "translateY(0)";
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placeholder Sections */}
        {activeSection === "browse-providers" && (
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Browse Providers</h2>
                <p style={{ margin: '6px 0 0 0', color: '#6b7280' }}>Find local providers and view their public profiles.</p>
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={providerQuery} onChange={(e) => setProviderQuery(e.target.value)} placeholder="Search by name, company or skill" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', width: 280 }} />
                  <button onClick={() => fetchProviders(providerQuery)} style={{ padding: '8px 12px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none' }}>{providersLoading ? 'Loading...' : 'Search'}</button>
                  <button onClick={() => { setProviderQuery(''); fetchProviders(''); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>Clear</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {providers.length === 0 && !providersLoading && (
                <div style={{ gridColumn: '1/-1', padding: 28, textAlign: 'center', color: '#6b7280' }}>
                  No providers loaded. Click "Refresh" to load available providers.
                </div>
              )}

              {providers.map((p) => (
                <div key={p.id} style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', flex: '0 0 64px' }}>
                    {p.photoUrl ? <img src={p.photoUrl} alt="provider" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No photo</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{`${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>{p.company || ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setSelectedProvider(p)} style={{ padding: '8px 12px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none' }}>View</button>
                      </div>
                    </div>
                    {p.bio && <div style={{ marginTop: 8, color: '#374151', fontSize: 13 }}>{p.bio.slice(0,180)}{p.bio.length>180?'...':''}</div>}
                  </div>
                </div>
              ))}
            </div>

              {/* auto-load providers when browse tab is opened */}

            {/* Provider modal */}
            {selectedProvider && (
              <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedProvider(null); }}>
                <div style={{ width: 720, maxWidth: '94%', background: 'white', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 84, height: 84, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
                      {selectedProvider.photoUrl ? <img src={selectedProvider.photoUrl} alt="provider" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No photo</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{`${selectedProvider.firstName || ''} ${selectedProvider.lastName || ''}`.trim() || selectedProvider.email}</div>
                      <div style={{ color: '#6b7280', marginTop: 6 }}>{selectedProvider.company || ''}</div>
                      {selectedProvider.skills && selectedProvider.skills.length > 0 && <div style={{ marginTop: 8, color: '#374151', fontSize: 13 }}>Skills: {selectedProvider.skills.join(', ')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {selectedProvider.phone ? (
                        <a href={`tel:${selectedProvider.phone}`} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', borderRadius: 8, textDecoration: 'none' }}>Call</a>
                      ) : null}
                      {selectedProvider.email ? (
                        <button onClick={() => { const subject = encodeURIComponent('Inquiry about your services'); const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedProvider.email)}&su=${subject}`; window.open(gmailUrl, '_blank'); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb' }}>Email</button>
                      ) : null}
                      <button onClick={() => setSelectedProvider(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#ef4444', color: 'white', border: 'none' }}>Close</button>
                    </div>
                  </div>

                  {selectedProvider.bio && <div style={{ marginTop: 12, color: '#374151' }}>{selectedProvider.bio}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* auto-fetch providers when Browse Providers tab selected */}
        {
          activeSection === 'browse-providers' && !providersLoading && providers.length === 0 && (() => { fetchProviders().catch(() => {}); return null; })()
        }

        {activeSection === "payment-history" && (
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Payment History</h2>
                <p style={{ margin: '6px 0 0 0', color: '#6b7280' }}>All invoices you received and payments made.</p>
              </div>
              <div>
                <button onClick={() => fetchInvoices()} style={{ padding: '8px 12px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none' }}>Refresh</button>
              </div>
            </div>

            {invoicesLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No invoices found.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {invoices.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{inv.serviceTitle || `Request #${inv.serviceRequestId}`}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{inv.notes || ''}</div>
                      {inv.paid ? <div style={{ marginTop: 6, display: 'inline-block', padding: '4px 8px', background: '#ecfccb', color: '#14532d', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Paid</div> : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{inv.currency || 'USD'} {Number(inv.amount).toFixed(2)}</div>
                      <div style={{ color: '#9ca3af', fontSize: 13 }}>{inv.createdAt ? new Date(inv.createdAt).toLocaleString() : ''}</div>
                      {!inv.paid && (
                        <div style={{ marginTop: 8 }}>
                          <button onClick={() => handlePay(inv.id)} style={{ padding: '8px 12px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none' }}>Pay</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "profile" && (
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>Profile Settings</h1>

            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Photo</label>
                  <div style={{ width: 100, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff' }}>
                    {profilePhoto ? (
                      // if photo is base64 or URL
                      // eslint-disable-next-line jsx-a11y/img-redundant-alt
                      <img src={profilePhoto} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>No photo</div>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setProfilePhoto(reader.result.toString());
                      reader.readAsDataURL(file);
                    }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>First name</label>
                  <input type="text" value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Last name</label>
                <input type="text" value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Email</label>
                <input type="email" value={profileEmail} readOnly disabled style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Phone</label>
                <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="e.g. +1 555 123 4567" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Address</label>
                <input type="text" value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} placeholder="Street, City, State, ZIP" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              </div>

              {profileError && (<div style={{ marginBottom: 12, color: '#b91c1c' }}>{profileError}</div>)}
              {profileSuccess && (<div style={{ marginBottom: 12, color: '#065f46' }}>{profileSuccess}</div>)}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={async () => {
                  // reload profile
                  setProfileLoading(true);
                  setProfileError('');
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_BASE}/customer/profile`, { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) throw new Error('Failed to load');
                    const data = await res.json();
                    setProfileFirstName(data.firstName || '');
                    setProfileLastName(data.lastName || '');
                    setProfilePhone(data.phone || '');
                    setProfileEmail(data.email || '');
                    setProfileAddress(data.address || '');
                    setProfilePhoto(data.photoUrl || null);
                  } catch (err) {
                    setProfileError('Failed to reload profile');
                  } finally { setProfileLoading(false); }
                }} className="" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f3f4f6' }}>Reload</button>

                <button onClick={async () => {
                  setProfileSaving(true);
                  setProfileError('');
                  try {
                    // guard against very large base64 images which can fail the network request
                    if (profilePhoto && profilePhoto.length > 1000000) {
                      throw new Error('Photo is too large. Please choose a smaller image (<=1MB).');
                    }
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_BASE}/customer/profile`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ firstName: profileFirstName, lastName: profileLastName, phone: profilePhone, photoUrl: profilePhoto, address: profileAddress })
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || 'Failed to save');
                    }
                    const data = await res.json();
                    // reflect name in sidebar
                    const display = `${data.firstName || ''} ${data.lastName || ''}`.trim() || undefined;
                    if (display) setUserName(display);
                    setProfileSuccess('Profile saved');
                    setTimeout(() => setProfileSuccess(''), 3500);
                  } catch (err) {
                    console.error(err);
                    setProfileError(err.message || 'Failed to save profile');
                  } finally { setProfileSaving(false); }
                }} style={{ padding: '10px 18px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none' }} disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
