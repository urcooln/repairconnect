import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.js";
import CustomerDashboard from "./pages/CustomerDashboard.js";
import ProviderDashboard from "./pages/ProviderDashboard.js";
import AdminDashboard from "./pages/AdminDashboard.js";
import AdminRequests from "./pages/AdminRequests.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx"; // ✅ import gatekeeper

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={<Home />} />

      {/* Customer-only */}
      <Route
        path="/customer/dashboard"
        element={
          <ProtectedRoute allowedRoles={["customer"]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Provider-only */}
      <Route
        path="/provider/dashboard"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderDashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin-only */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminRequests />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
