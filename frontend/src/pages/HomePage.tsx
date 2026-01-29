import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const HomePage = () => {
  const { user, isLoading } = useAuth();

  // Redirect authenticated users to recipes
  if (!isLoading && user) {
    return <Navigate to="/recipes" replace />;
  }

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-base-200">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-5xl font-bold mb-6">Forest Manager</h1>
        <p className="text-xl text-base-content/70 mb-8">
          Partagez vos recettes avec votre communaute
        </p>

        <div className="flex gap-4 justify-center">
          <Link to="/signup" className="btn btn-primary btn-lg">
            Commencer
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
