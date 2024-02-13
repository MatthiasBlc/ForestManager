import { User } from "../../../models/user";
import APIManager from "../../../network/api";

interface NavBarLoggedInViewProps {
  user: User;
  onLogoutSuccessful: () => void;
}

const NavBarLoggedInView = ({
  user,
  onLogoutSuccessful,
}: NavBarLoggedInViewProps) => {
  async function logout() {
    try {
      await APIManager.logout();
      onLogoutSuccessful();
    } catch (error) {
      alert(error);
      console.error(error);
    }
  }

  return (
    <>
      <div className="flex-none">
        <a className="btn btn-ghost normal-case text-xl">
          Signed in as: {user.username}
        </a>
      </div>
      <button className="btn btn-square btn-ghost" onClick={logout}>
        Log out
      </button>
    </>
  );
};

export default NavBarLoggedInView;
