import { Link, useLocation } from "react-router-dom";
import { FaBook, FaUsers, FaPlus, FaBars } from "react-icons/fa";

interface SidebarProps {
  onNavigate?: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

const Sidebar = ({ onNavigate, isCompact = false, onToggleCompact }: SidebarProps) => {
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
      {/* Header with toggle button - Desktop only (pointer device) */}
      <div className={`hidden pointer-fine:flex p-4 border-b border-base-300 ${isCompact ? "justify-center" : "justify-between items-center"}`}>
        {!isCompact && <span className="text-lg font-bold">Menu</span>}
        <button
          onClick={onToggleCompact}
          className={`btn btn-ghost btn-sm ${isCompact ? "tooltip tooltip-right" : ""}`}
          data-tip={isCompact ? "Expand menu" : undefined}
          aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
        >
          <FaBars className="w-4 h-4" />
        </button>
      </div>

      {/* Logo/Brand for mobile drawer (touch devices) */}
      <div className={`p-4 border-b border-base-300 pointer-fine:hidden ${isCompact ? "text-center" : ""}`}>
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
      <div className={`border-t border-base-300 ${isCompact ? "p-2" : "p-4"}`}>
        <p className={`text-xs text-base-content/50 text-center ${isCompact ? "writing-mode-vertical" : ""}`}>
          {isCompact ? "v0.1" : "Forest Manager v0.1"}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
