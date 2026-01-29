import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../contexts/AdminAuthContext";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { admin, isLoading, authStep } = useAdminAuth();

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!admin || authStep !== "authenticated") {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

export default AdminProtectedRoute;
