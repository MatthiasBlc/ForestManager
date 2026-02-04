import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NavBarLoggedInView from "./NavBarLoggedInView/NavBarLoggedInView";
import NavBarLoggedOutView from "./NavBarLoggedOutView/NavBarLoggedOutView";
import NotificationDropdown from "./NotificationDropdown";

const NavBar = () => {
  const { user } = useAuth();

  return (
    <div className="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl">
          Forest Manager
        </Link>
      </div>
      <div className="flex-none gap-1">
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
