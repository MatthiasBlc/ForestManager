import { Link, useLocation } from "react-router-dom";
import { FaBook, FaUsers, FaHome } from "react-icons/fa";

interface SidebarProps {
  onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const location = useLocation();

  const menuItems = [
    { path: "/", label: "Home", icon: FaHome },
    { path: "/recipes", label: "My Recipes", icon: FaBook },
    { path: "/communities", label: "Communities", icon: FaUsers },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo/Brand for mobile drawer */}
      <div className="p-4 border-b border-base-300 lg:hidden">
        <span className="text-xl font-bold">Forest Manager</span>
      </div>

      {/* Navigation Menu */}
      <ul className="menu p-4 flex-1">
        <li className="menu-title">
          <span>Navigation</span>
        </li>
        {menuItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onNavigate}
              className={isActive(item.path) ? "active" : ""}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          </li>
        ))}

        {/* Communities Section - placeholder for Phase 3 */}
        <li className="menu-title mt-4">
          <span>My Communities</span>
        </li>
        <li className="disabled">
          <span className="text-base-content/50 text-sm">
            No communities yet
          </span>
        </li>
        <li>
          <Link
            to="/communities/create"
            onClick={onNavigate}
            className="text-primary"
          >
            + Create Community
          </Link>
        </li>
      </ul>

      {/* Footer */}
      <div className="p-4 border-t border-base-300">
        <p className="text-xs text-base-content/50 text-center">
          Forest Manager v0.1
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
