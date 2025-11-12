import { useState, useEffect } from "react";
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
  }, []);

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
    { id: "browse-providers", label: "Browse Providers", icon: "🔍", active: false },
    { id: "payment-history", label: "Payment History", icon: "💳", active: false },
    { id: "profile", label: "Profile Settings", icon: "⚙️", active: false }
  ];

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
          <div style={{
            backgroundColor: "white",
            padding: "80px 40px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: "72px", marginBottom: "20px" }}>🔍</div>
            <h1 style={{ margin: "0 0 16px 0", fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
              Browse Providers
            </h1>
            <p style={{ fontSize: "17px", color: "#6b7280", margin: "0 0 8px 0", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
              Coming soon! You'll be able to browse and select service providers here.
            </p>
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              🔒 This feature is currently under development
            </p>
          </div>
        )}

        {activeSection === "payment-history" && (
          <div style={{
            backgroundColor: "white",
            padding: "80px 40px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: "72px", marginBottom: "20px" }}>💳</div>
            <h1 style={{ margin: "0 0 16px 0", fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
              Payment History
            </h1>
            <p style={{ fontSize: "17px", color: "#6b7280", margin: "0 0 8px 0", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
              Coming soon! View all your payment transactions and invoices here.
            </p>
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              🔒 This feature is currently under development
            </p>
          </div>
        )}

        {activeSection === "profile" && (
          <div style={{
            backgroundColor: "white",
            padding: "80px 40px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: "72px", marginBottom: "20px" }}>⚙️</div>
            <h1 style={{ margin: "0 0 16px 0", fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
              Profile Settings
            </h1>
            <p style={{ fontSize: "17px", color: "#6b7280", margin: "0 0 8px 0", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
              Coming soon! Manage your profile, saved addresses, and preferences here.
            </p>
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              🔒 This feature is currently under development
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
