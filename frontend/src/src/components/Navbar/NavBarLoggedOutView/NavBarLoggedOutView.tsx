import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";

const NavBarLoggedOutView = () => {
  const { openLoginModal } = useAuth();

  return (
    <>
      <div className="flex-none">
        <Link to="/signup" className="btn btn-ghost">
          Sign Up
        </Link>
      </div>
      <button className="btn btn-ghost" onClick={openLoginModal}>
        Log In
      </button>
    </>
  );
};

export default NavBarLoggedOutView;
