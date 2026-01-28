import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NavBarLoggedInView from "./NavBarLoggedInView/NavBarLoggedInView";
import NavBarLoggedOutView from "./NavBarLoggedOutView/NavBarLoggedOutView";

const NavBar = () => {
  const { user } = useAuth();

  return (
    <div className="navbar bg-base-100">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost normal-case text-xl">
          Boiler Plate App
        </Link>
        <ul className="menu menu-horizontal px-1">
          <li>
            <Link to="/privacy">Privacy</Link>
          </li>
        </ul>
      </div>
      <div className="flex-none">
        {user ? <NavBarLoggedInView /> : <NavBarLoggedOutView />}
      </div>
    </div>
  );
};

export default NavBar;
