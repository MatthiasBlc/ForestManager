import { Link } from "react-router-dom";
import { User } from "../../models/user";
import NavBarLoggedInView from "./NavBarLoggedInView/NavBarLoggedInView";
import NavBarLoggedOutView from "./NavBarLoggedOutView/NavBarLoggedOutView";

interface NavBarProps {
  loggedInUser: User | null;
  onSignUpClicked: () => void;
  onLoginClicked: () => void;
  onLogoutSuccessful: () => void;
}

const NavBar = ({
  loggedInUser,
  onSignUpClicked,
  onLoginClicked,
  onLogoutSuccessful,
}: NavBarProps) => {
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
        {loggedInUser ? (
          <NavBarLoggedInView
            user={loggedInUser}
            onLogoutSuccessful={onLogoutSuccessful}
          />
        ) : (
          <NavBarLoggedOutView
            onLoginClicked={onLoginClicked}
            onSignUpClicked={onSignUpClicked}
          />
        )}
      </div>
      {/* <div className="flex-none">
        <ul className="menu menu-horizontal px-1">
          <li>
            <a>Link</a>
          </li>
          <li>
            <details>
              <summary>Parent</summary>
              <ul className="p-2 bg-base-100">
                <li>
                  <a>Link 1</a>
                </li>
                <li>
                  <a>Link 2</a>
                </li>
              </ul>
            </details>
          </li>
        </ul>
      </div>
      <div className="dropdown dropdown-end">
        <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
          <div className="w-10 rounded-full">
            <img src="/images/stock/photo-1534528741775-53994a69daeb.jpg" />
          </div>
        </label>
        <ul
          tabIndex={0}
          className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
        >
          <li>
            <a className="justify-between">
              Profile
              <span className="badge">New</span>
            </a>
          </li>
          <li>
            <a>Settings</a>
          </li>
          <li>
            <a>Logout</a>
          </li>
        </ul>
      </div> */}
    </div>
  );
};

export default NavBar;
