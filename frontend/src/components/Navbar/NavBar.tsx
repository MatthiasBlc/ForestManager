import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import NavBarLoggedInView from "./NavBarLoggedInView/NavBarLoggedInView";
import NavBarLoggedOutView from "./NavBarLoggedOutView/NavBarLoggedOutView";
import NotificationDropdown from "./NotificationDropdown";

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const NavBar = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl">
          Forest Manager
        </Link>
      </div>
      <div className="flex-none gap-1">
        <button
          className="btn btn-ghost btn-circle"
          onClick={toggleTheme}
          aria-label={theme === "forest" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "forest" ? <SunIcon /> : <MoonIcon />}
        </button>
        {user ? (
          <>
            <NotificationDropdown />
            <NavBarLoggedInView />
          </>
        ) : (
          <NavBarLoggedOutView />
        )}
      </div>
    </div>
  );
};

export default NavBar;
