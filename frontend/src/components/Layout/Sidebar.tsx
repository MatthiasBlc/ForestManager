import { Link, useLocation } from "react-router-dom";
import { FaBook, FaUsers, FaPlus } from "react-icons/fa";

interface SidebarProps {
  onNavigate?: () => void;
  isCompact?: boolean;
}

const Sidebar = ({ onNavigate, isCompact = false }: SidebarProps) => {
  const location = useLocation();

  const menuItems = [
    { path: "/recipes", label: "My Recipes", icon: FaBook },
    { path: "/communities", label: "Communities", icon: FaUsers },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo/Brand for mobile drawer */}
      <div className={`p-4 border-b border-base-300 lg:hidden ${isCompact ? "text-center" : ""}`}>
        <span className="text-xl font-bold">{isCompact ? "FM" : "Forest Manager"}</span>
      </div>

      {/* Navigation Menu */}
      <ul className={`menu flex-1 ${isCompact ? "p-2" : "p-4"}`}>
        {!isCompact && (
          <li className="menu-title">
            <span>Navigation</span>
          </li>
        )}
        {menuItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onNavigate}
              className={`${isActive(item.path) ? "active" : ""} ${isCompact ? "justify-center tooltip tooltip-right" : ""}`}
              data-tip={isCompact ? item.label : undefined}
            >
              <item.icon className={isCompact ? "w-5 h-5" : "w-4 h-4"} />
              {!isCompact && item.label}
            </Link>
          </li>
        ))}

        {/* Communities Section - placeholder for Phase 3 */}
        {!isCompact && (
          <>
            <li className="menu-title mt-4">
              <span>My Communities</span>
            </li>
            <li className="disabled">
              <span className="text-base-content/50 text-sm">
                No communities yet
              </span>
            </li>
          </>
        )}
        <li>
          <Link
            to="/communities/create"
            onClick={onNavigate}
            className={`text-primary ${isCompact ? "justify-center tooltip tooltip-right" : ""}`}
            data-tip={isCompact ? "Create Community" : undefined}
          >
            <FaPlus className={isCompact ? "w-5 h-5" : "w-4 h-4"} />
            {!isCompact && "Create Community"}
          </Link>
        </li>
      </ul>

      {/* Footer */}
      {!isCompact && (
        <div className="p-4 border-t border-base-300">
          <p className="text-xs text-base-content/50 text-center">
            Forest Manager v0.1
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
