interface NavBarLoggedOutViewProps {
  onSignUpClicked: () => void,
  onLoginClicked: () => void,

}

const NavBarLoggedOutView = ({ onSignUpClicked, onLoginClicked }: NavBarLoggedOutViewProps) => {

  return (
    <>
      <div className="flex-none">
        <button className="btn btn-square btn-ghost" onClick={onSignUpClicked}>
          Sign Up
        </button>
      </div>
      <button className="btn btn-square btn-ghost" onClick={onLoginClicked}>
        Log In
      </button>
    </>
  );
}

export default NavBarLoggedOutView;