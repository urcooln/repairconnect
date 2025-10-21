// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import jwtDecode from "jwt-decode";

export default function ProtectedRoute({ children, allowedRoles }) {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      console.log('No token found');
      return <Navigate to="/" replace />;
    }

    const decoded = jwtDecode(token);
    console.log('Decoded token in ProtectedRoute:', decoded);

    if (!decoded || !decoded.role) {
      console.log('Invalid token format');
      localStorage.removeItem("token");
      return <Navigate to="/" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(decoded.role)) {
      console.log('Role not allowed:', decoded.role);
      return <Navigate to="/" replace />;
    }

    // Check token expiration
    const currentTime = Date.now() / 1000;
    if (decoded.exp && decoded.exp < currentTime) {
      console.log('Token expired');
      localStorage.removeItem("token");
      return <Navigate to="/" replace />;
    }

    return children;
  } catch (error) {
    console.error('Protected route error:', error);
    localStorage.removeItem("token");
    return <Navigate to="/" replace />;
  }
}
