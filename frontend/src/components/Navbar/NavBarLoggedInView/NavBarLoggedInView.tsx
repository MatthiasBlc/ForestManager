import { useAuth } from "../../../contexts/AuthContext";

const NavBarLoggedInView = () => {
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      alert(error);
      console.error(error);
    }
  }

  return (
    <>
      <div className="flex-none">
        <span className="btn btn-ghost normal-case text-xl">{user?.username}</span>
      </div>
      <button className="btn btn-square btn-ghost" onClick={handleLogout}>
        Log out
      </button>
    </>
  );
};

export default NavBarLoggedInView;
