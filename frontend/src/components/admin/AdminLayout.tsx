import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "../../contexts/AdminAuthContext";
import { FaHome, FaTags, FaCarrot, FaBalanceScale, FaStar, FaUsers, FaClipboardList, FaSignOutAlt } from "react-icons/fa";

const adminNavItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: FaHome },
  { to: "/admin/tags", label: "Tags", icon: FaTags },
  { to: "/admin/ingredients", label: "Ingredients", icon: FaCarrot },
  { to: "/admin/units", label: "Units", icon: FaBalanceScale },
  { to: "/admin/features", label: "Features", icon: FaStar },
  { to: "/admin/communities", label: "Communities", icon: FaUsers },
  { to: "/admin/activity", label: "Activity", icon: FaClipboardList },
];

function AdminLayoutInner() {
  const { admin, authStep } = useAdminAuth();
  const location = useLocation();

  // Login page renders without sidebar
  if (!admin || authStep !== "authenticated" || location.pathname === "/admin/login") {
    return <Outlet />;
  }

  return <AdminShell />;
}

function AdminShell() {
  const { admin, logout } = useAdminAuth();

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="min-h-screen flex bg-base-200">
      {/* Sidebar */}
      <aside className="w-64 bg-base-100 border-r border-base-300 flex flex-col shrink-0">
        <div className="p-4 border-b border-base-300">
          <h1 className="text-lg font-bold">FM Admin</h1>
        </div>

        <nav className="flex-1 p-2">
          <ul className="menu gap-1">
            {adminNavItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 ${isActive ? "active" : ""}`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-base-300">
          <div className="text-sm text-base-content/70 truncate mb-2">{admin?.email}</div>
          <button className="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={handleLogout}>
            <FaSignOutAlt className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner />
    </AdminAuthProvider>
  );
}

export default AdminLayout;
