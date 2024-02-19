import RecipesPageLoggedInView from "../components/RecipesPageLoggedInView";
import RecipesPageLoggedOutView from "../components/RecipesPageLoggedOutView";
import { User } from "../models/user";

interface RecipesPageProps {
  loggedInUser: User | null;
}

const RecipesPage = ({ loggedInUser }: RecipesPageProps) => {
  return (
    <div>
      {loggedInUser ? (
        <RecipesPageLoggedInView />
      ) : (
        <RecipesPageLoggedOutView />
      )}
    </div>
  );
};

export default RecipesPage;
