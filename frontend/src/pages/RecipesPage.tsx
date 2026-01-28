import RecipesPageLoggedInView from "../components/RecipesPageLoggedInView";
import RecipesPageLoggedOutView from "../components/RecipesPageLoggedOutView";
import { useAuth } from "../contexts/AuthContext";

const RecipesPage = () => {
  const { user } = useAuth();

  return (
    <div>
      {user ? (
        <RecipesPageLoggedInView />
      ) : (
        <RecipesPageLoggedOutView />
      )}
    </div>
  );
};

export default RecipesPage;
