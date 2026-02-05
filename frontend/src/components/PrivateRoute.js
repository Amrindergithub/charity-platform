import { Navigate } from "react-router-dom";

export default function PrivateRoute({ user, children, requiredRole }) {
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}
