import { Outlet } from "react-router-dom";
import { AdminAuthProvider } from "../../contexts/AdminAuthContext";

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}

export default AdminLayout;
