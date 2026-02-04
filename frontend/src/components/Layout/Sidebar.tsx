import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaBook, FaPlus, FaBars, FaHome } from "react-icons/fa";
import { CommunityListItem } from "../../models/community";
import APIManager from "../../network/api";

interface SidebarProps {
  onNavigate?: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

const CommunityAvatar = ({
  community,
  isActive,
  isCompact,
  onClick,
}: {
  community: CommunityListItem;
  isActive: boolean;
  isCompact: boolean;
  onClick?: () => void;
}) => {
  const initial = community.name.charAt(0).toUpperCase();

  return (
    <Link
      to={`/communities/${community.id}`}
      onClick={onClick}
      className={`group flex items-center gap-3 ${isCompact ? "justify-center tooltip tooltip-right" : ""}`}
      data-tip={isCompact ? community.name : undefined}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold transition-all duration-200 group-hover:rounded-xl ${
          isActive
            ? "bg-primary text-primary-content rounded-xl"
            : "bg-base-300 text-base-content/70 group-hover:bg-primary group-hover:text-primary-content"
        }`}
      >
        {initial}
      </div>
      {!isCompact && (
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>
            {community.name}
          </p>
          <p className="text-xs text-base-content/50">
            {community.membersCount} {community.membersCount === 1 ? "member" : "members"}
          </p>
        </div>
      )}
    </Link>
  );
};

const Sidebar = ({ onNavigate, isCompact = false, onToggleCompact }: SidebarProps) => {
  const location = useLocation();
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);

  useEffect(() => {
    async function loadCommunities() {
      try {
        const response = await APIManager.getCommunities();
        setCommunities(response.data);
      } catch {
        // Silently fail - sidebar communities are non-critical
      }
    }

    loadCommunities();
  }, [location.pathname]);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with toggle button - Desktop only */}
      <div className={`hidden pointer-fine:flex p-3 border-b border-base-300 ${isCompact ? "justify-center" : "justify-between items-center"}`}>
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

      {/* Mobile header */}
      <div className={`p-3 border-b border-base-300 pointer-fine:hidden ${isCompact ? "text-center" : ""}`}>
        <span className="text-xl font-bold">{isCompact ? "FM" : "Forest Manager"}</span>
      </div>

      {/* Navigation */}
      <div className={`${isCompact ? "p-2" : "p-3"}`}>
        {/* Dashboard */}
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
            isActive("/dashboard") ? "bg-base-300" : "hover:bg-base-300/50"
          } ${isCompact ? "justify-center tooltip tooltip-right" : ""}`}
          data-tip={isCompact ? "Dashboard" : undefined}
        >
          <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
            isActive("/dashboard") ? "bg-primary text-primary-content rounded-xl" : "bg-base-300 text-base-content/70"
          }`}>
            <FaHome className="w-5 h-5" />
          </div>
          {!isCompact && <span className="text-sm font-medium">Dashboard</span>}
        </Link>

        {/* Recipes */}
        <Link
          to="/recipes"
          onClick={onNavigate}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors mt-1 ${
            isActive("/recipes") ? "bg-base-300" : "hover:bg-base-300/50"
          } ${isCompact ? "justify-center tooltip tooltip-right" : ""}`}
          data-tip={isCompact ? "My Recipes" : undefined}
        >
          <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
            isActive("/recipes") ? "bg-primary text-primary-content rounded-xl" : "bg-base-300 text-base-content/70"
          }`}>
            <FaBook className="w-5 h-5" />
          </div>
          {!isCompact && <span className="text-sm font-medium">My Recipes</span>}
        </Link>
      </div>

      {/* Divider */}
      <div className="px-3">
        <div className="border-t border-base-300" />
      </div>

      {/* Communities */}
      <div className={`flex-1 overflow-y-auto ${isCompact ? "p-2" : "p-3"}`}>
        {!isCompact && (
          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2 px-2">
            Communities
          </p>
        )}

        <div className="space-y-1">
          {communities.map((community) => (
            <div key={community.id} className={`p-1 rounded-lg transition-colors ${
              isActive(`/communities/${community.id}`) ? "bg-base-300" : "hover:bg-base-300/50"
            }`}>
              <CommunityAvatar
                community={community}
                isActive={isActive(`/communities/${community.id}`)}
                isCompact={isCompact}
                onClick={onNavigate}
              />
            </div>
          ))}
        </div>

        {/* Create community */}
        <Link
          to="/communities/create"
          onClick={onNavigate}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors mt-2 hover:bg-base-300/50 ${
            isCompact ? "justify-center tooltip tooltip-right" : ""
          }`}
          data-tip={isCompact ? "Create Community" : undefined}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center bg-base-300 text-primary hover:bg-primary hover:text-primary-content transition-all hover:rounded-xl border-2 border-dashed border-primary/30">
            <FaPlus className="w-4 h-4" />
          </div>
          {!isCompact && <span className="text-sm font-medium text-primary">Create Community</span>}
        </Link>
      </div>

      {/* Footer */}
      <div className={`border-t border-base-300 ${isCompact ? "p-2" : "p-3"}`}>
        <p className={`text-xs text-base-content/50 text-center`}>
          {isCompact ? "v0.1" : "Forest Manager v0.1"}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
