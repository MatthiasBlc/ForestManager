import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaPlus, FaTh, FaList } from "react-icons/fa";
import { CommunityRecipeListItem, RecipeListItem } from "../../models/recipe";
import APIManager from "../../network/api";
import { useAuth } from "../../contexts/AuthContext";
import RecipeCard from "../recipes/RecipeCard";
import RecipeListRow from "../recipes/RecipeListRow";
import RecipeFilters from "../recipes/RecipeFilters";
import { usePaginatedList } from "../../hooks/usePaginatedList";

type ViewMode = "card" | "list";

const RECIPES_PER_PAGE = 12;

interface CommunityRecipesListProps {
  communityId: string;
  initialTags?: string | null;
}

const CommunityRecipesList = ({ communityId, initialTags }: CommunityRecipesListProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("recipesViewMode");
    return (saved === "list" || saved === "card") ? saved : "card";
  });

  const [searchFilter, setSearchFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState<string[]>(() =>
    initialTags ? initialTags.split(",").filter(Boolean) : []
  );
  const [ingredientsFilter, setIngredientsFilter] = useState<string[]>([]);

  const toggleViewMode = () => {
    const newMode = viewMode === "card" ? "list" : "card";
    setViewMode(newMode);
    localStorage.setItem("recipesViewMode", newMode);
  };

  const fetchRecipes = useCallback(
    (params: { limit: number; offset: number }) =>
      APIManager.getCommunityRecipes(communityId, {
        ...params,
        search: searchFilter || undefined,
        tags: tagsFilter.length > 0 ? tagsFilter : undefined,
        ingredients: ingredientsFilter.length > 0 ? ingredientsFilter : undefined,
      }),
    [communityId, searchFilter, tagsFilter, ingredientsFilter]
  );

  const {
    data: recipes, pagination, isLoading: recipesLoading, isLoadingMore: loadingMore,
    error, loadMore: handleLoadMore, setData: setRecipes, setPagination,
  } = usePaginatedList<CommunityRecipeListItem>(fetchRecipes, RECIPES_PER_PAGE, [fetchRecipes]);

  const handleTagClick = (tag: string) => {
    if (!tagsFilter.includes(tag)) {
      setTagsFilter([...tagsFilter, tag]);
    }
  };

  const handleResetFilters = () => {
    setSearchFilter("");
    setTagsFilter([]);
    setIngredientsFilter([]);
  };

  async function deleteRecipe(recipe: RecipeListItem | CommunityRecipeListItem) {
    try {
      await APIManager.deleteRecipe(recipe.id);
      setRecipes(recipes.filter((r) => r.id !== recipe.id));
      if (pagination) {
        setPagination({ ...pagination, total: pagination.total - 1 });
      }
      toast.success("Recipe deleted");
    } catch {
      toast.error("Failed to delete recipe");
    }
  }

  const hasFilters = searchFilter || tagsFilter.length > 0 || ingredientsFilter.length > 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Recipes</h2>
        <div className="flex gap-2">
          <div className="join">
            <button
              className={`btn btn-sm join-item ${viewMode === "card" ? "btn-active" : ""}`}
              onClick={() => viewMode !== "card" && toggleViewMode()}
              aria-label="Card view"
            >
              <FaTh />
            </button>
            <button
              className={`btn btn-sm join-item ${viewMode === "list" ? "btn-active" : ""}`}
              onClick={() => viewMode !== "list" && toggleViewMode()}
              aria-label="List view"
            >
              <FaList />
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => navigate(`/communities/${communityId}/recipes/new`)}
          >
            <FaPlus />
            New Recipe
          </button>
        </div>
      </div>

      <div className="mb-6">
        <RecipeFilters
          search={searchFilter}
          tags={tagsFilter}
          ingredients={ingredientsFilter}
          onSearchChange={setSearchFilter}
          onTagsChange={setTagsFilter}
          onIngredientsChange={setIngredientsFilter}
          onReset={handleResetFilters}
          communityId={communityId}
        />
      </div>

      {recipesLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>Something went wrong. Please try again.</span>
        </div>
      )}

      {!recipesLoading && !error && (
        <>
          {recipes.length > 0 ? (
            <>
              {viewMode === "card" ? (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {recipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      onDelete={deleteRecipe}
                      onTagClick={handleTagClick}
                      showCreator
                      canEdit={recipe.creatorId === user?.id}
                      canDelete={recipe.creatorId === user?.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {recipes.map((recipe) => (
                    <RecipeListRow
                      key={recipe.id}
                      recipe={recipe}
                      onDelete={deleteRecipe}
                      onTagClick={handleTagClick}
                      showCreator
                      canEdit={recipe.creatorId === user?.id}
                      canDelete={recipe.creatorId === user?.id}
                    />
                  ))}
                </div>
              )}

              {pagination?.hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    className="btn btn-outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      `Load more (${recipes.length} of ${pagination.total})`
                    )}
                  </button>
                </div>
              )}

              {pagination && !pagination.hasMore && recipes.length > RECIPES_PER_PAGE && (
                <p className="text-center mt-8 text-base-content/60">
                  Showing all {pagination.total} recipes
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-base-content/60 mb-4">
                {hasFilters
                  ? "No recipes match your filters"
                  : "No recipes in this community yet"}
              </p>
              {hasFilters && (
                <button className="btn btn-ghost" onClick={handleResetFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityRecipesList;
