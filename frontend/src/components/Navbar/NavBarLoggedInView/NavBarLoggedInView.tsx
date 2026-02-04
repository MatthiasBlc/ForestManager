import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaUser, FaUserCircle, FaEnvelope, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "../../../contexts/AuthContext";
import InvitationBadge from "../../invitations/InvitationBadge";

const NavBarLoggedInView = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="btn btn-ghost btn-circle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        <FaUser className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-base-300">
            <p className="font-medium">{user?.username}</p>
            <p className="text-sm text-base-content/60">{user?.email}</p>
          </div>

          {/* Menu items */}
          <ul className="menu p-2">
            <li>
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3"
              >
                <FaUserCircle className="w-4 h-4" />
                My profile
              </Link>
            </li>
            <li>
              <Link
                to="/invitations"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3"
              >
                <FaEnvelope className="w-4 h-4" />
                <span className="flex items-center gap-2">
                  Invitations
                  <InvitationBadge />
                </span>
              </Link>
            </li>
          </ul>

          {/* Logout */}
          <div className="border-t border-base-300 p-2">
            <button
              className="btn btn-ghost btn-sm w-full justify-start gap-3 text-error"
              onClick={handleLogout}
            >
              <FaSignOutAlt className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavBarLoggedInView;
