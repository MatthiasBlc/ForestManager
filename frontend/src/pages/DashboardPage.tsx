import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaPlus } from "react-icons/fa";
import { CommunityListItem } from "../models/community";
import { RecipeListItem } from "../models/recipe";
import APIManager from "../network/api";
import CommunityCard from "../components/communities/CommunityCard";
import RecipeCard from "../components/recipes/RecipeCard";
import DataContainer from "../components/DataContainer";
import { ActivityFeed } from "../components/activity";
import { useAsyncData } from "../hooks/useAsyncData";

const RECENT_RECIPES_LIMIT = 8;

const DashboardPage = () => {
  const navigate = useNavigate();

  const {
    data: communities,
    isLoading: isLoadingCommunities,
    error: communitiesError,
  } = useAsyncData<CommunityListItem[]>(() => APIManager.getCommunities().then((r) => r.data), []);

  const {
    data: recipesData,
    isLoading: isLoadingRecipes,
    error: recipesError,
    setData: setRecipesData,
  } = useAsyncData(
    () =>
      APIManager.getRecipes({ limit: RECENT_RECIPES_LIMIT }).then((r) => ({
        recipes: r.data,
        total: r.pagination.total,
      })),
    []
  );

  const recipes = recipesData?.recipes ?? [];
  const totalRecipes = recipesData?.total ?? 0;

  const handleDeleteRecipe = async (recipe: RecipeListItem) => {
    try {
      await APIManager.deleteRecipe(recipe.id);
      setRecipesData((prev) =>
        prev
          ? {
              recipes: prev.recipes.filter((r) => r.id !== recipe.id),
              total: prev.total - 1,
            }
          : prev
      );
      toast.success("Recipe deleted");
    } catch {
      toast.error("Failed to delete recipe");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      {/* Communities Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Communities</h2>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => navigate("/communities/create")}
          >
            <FaPlus />
            New Community
          </button>
        </div>

        <DataContainer
          isLoading={isLoadingCommunities}
          error={communitiesError}
          isEmpty={(communities?.length ?? 0) === 0}
          emptyMessage="You are not a member of any community yet."
          emptyAction={
            <button
              className="btn btn-primary gap-2"
              onClick={() => navigate("/communities/create")}
            >
              <FaPlus />
              Create your first community
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {(communities ?? []).map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        </DataContainer>
      </section>

      {/* Recipes Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Recipes</h2>
          <div className="flex gap-2">
            {totalRecipes > RECENT_RECIPES_LIMIT && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/recipes")}>
                See all ({totalRecipes})
              </button>
            )}
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => navigate("/recipes/new")}
            >
              <FaPlus />
              New Recipe
            </button>
          </div>
        </div>

        <DataContainer
          isLoading={isLoadingRecipes}
          error={recipesError}
          isEmpty={recipes.length === 0}
          emptyMessage="You don't have any recipes yet."
          emptyAction={
            <button className="btn btn-primary gap-2" onClick={() => navigate("/recipes/new")}>
              <FaPlus />
              Create your first recipe
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onDelete={handleDeleteRecipe} />
            ))}
          </div>
        </DataContainer>
      </section>

      {/* Activity Feed Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Recent Activity</h2>
        </div>
        <div className="bg-base-100 rounded-lg shadow p-6">
          <ActivityFeed personal limit={10} />
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
