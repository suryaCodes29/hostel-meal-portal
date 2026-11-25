import { Navigate } from "react-router-dom";
import { getStoredToken, getStoredUser } from "../services/studentApi";

function RoleProtectedRoute({ requiredRole, children }) {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user || user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

export default RoleProtectedRoute;