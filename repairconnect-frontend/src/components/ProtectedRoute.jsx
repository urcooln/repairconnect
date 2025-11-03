// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("rc_token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  try {
    const decoded = jwtDecode(token);

    if (allowedRoles && !allowedRoles.includes(decoded.role)) {
      return <Navigate to="/" replace />;
    }

    return children;
  } catch {
    return <Navigate to="/" replace />;
  }
}
