import { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FaPlus, FaTh, FaList } from "react-icons/fa";
import { RecipeListItem } from "../models/recipe";
import APIManager from "../network/api";
import RecipeCard from "./recipes/RecipeCard";
import RecipeListRow from "./recipes/RecipeListRow";
import RecipeFilters from "./recipes/RecipeFilters";
import { SharePersonalRecipeModal } from "./share";
import { usePaginatedList } from "../hooks/usePaginatedList";

type ViewMode = "card" | "list";

const RECIPES_PER_PAGE = 12;

const RecipesPageLoggedInView = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [shareRecipe, setShareRecipe] = useState<RecipeListItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("recipesViewMode");
    return (saved === "list" || saved === "card") ? saved : "card";
  });

  const toggleViewMode = () => {
    const newMode = viewMode === "card" ? "list" : "card";
    setViewMode(newMode);
    localStorage.setItem("recipesViewMode", newMode);
  };

  const searchFilter = searchParams.get("search") || "";
  const tagsParam = searchParams.get("tags") || "";
  const tagsFilter = useMemo(
    () => tagsParam.split(",").filter(Boolean),
    [tagsParam]
  );
  const ingredientsParam = searchParams.get("ingredients") || "";
  const ingredientsFilter = useMemo(
    () => ingredientsParam.split(",").filter(Boolean),
    [ingredientsParam]
  );

  const fetchRecipes = useCallback(
    (params: { limit: number; offset: number }) =>
      APIManager.getRecipes({
        ...params,
        search: searchFilter || undefined,
        tags: tagsFilter.length > 0 ? tagsFilter : undefined,
        ingredients: ingredientsFilter.length > 0 ? ingredientsFilter : undefined,
      }),
    [searchFilter, tagsFilter, ingredientsFilter]
  );

  const {
    data: recipes, pagination, isLoading: recipesLoading, isLoadingMore: loadingMore,
    error: showRecipesLoadingError, loadMore: handleLoadMore, setData: setRecipes, setPagination,
  } = usePaginatedList(fetchRecipes, RECIPES_PER_PAGE, [fetchRecipes]);

  const handleSearchChange = (search: string) => {
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    setSearchParams(params);
  };

  const handleTagsChange = (tags: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    } else {
      params.delete("tags");
    }
    setSearchParams(params);
  };

  const handleIngredientsChange = (ingredients: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (ingredients.length > 0) {
      params.set("ingredients", ingredients.join(","));
    } else {
      params.delete("ingredients");
    }
    setSearchParams(params);
  };

  const handleTagClick = (tag: string) => {
    if (!tagsFilter.includes(tag)) {
      handleTagsChange([...tagsFilter, tag]);
    }
  };

  const handleResetFilters = () => {
    setSearchParams({});
  };

  const handleShareRecipe = (recipe: RecipeListItem) => {
    setShareRecipe(recipe);
  };

  const handleSharePublished = () => {
    setShareRecipe(null);
  };

  async function deleteRecipe(recipe: RecipeListItem) {
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

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Recipes</h1>
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
            className="btn btn-primary gap-2"
            onClick={() => navigate("/recipes/new")}
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
          onSearchChange={handleSearchChange}
          onTagsChange={handleTagsChange}
          onIngredientsChange={handleIngredientsChange}
          onReset={handleResetFilters}
        />
      </div>

      {recipesLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {showRecipesLoadingError && (
        <div className="alert alert-error">
          <span>Something went wrong. Please refresh the page.</span>
        </div>
      )}

      {!recipesLoading && !showRecipesLoadingError && (
        <>
          {recipes.length > 0 ? (
            <>
              {viewMode === "card" ? (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      onDelete={deleteRecipe}
                      onTagClick={handleTagClick}
                      onShare={handleShareRecipe}
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
                      onShare={handleShareRecipe}
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
                {searchFilter || tagsFilter.length > 0 || ingredientsFilter.length > 0
                  ? "No recipes match your filters"
                  : "You don't have any recipes yet"}
              </p>
              {(searchFilter || tagsFilter.length > 0 || ingredientsFilter.length > 0) && (
                <button className="btn btn-ghost" onClick={handleResetFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {shareRecipe && (
        <SharePersonalRecipeModal
          recipeId={shareRecipe.id}
          recipeTitle={shareRecipe.title}
          onClose={() => setShareRecipe(null)}
          onPublished={handleSharePublished}
        />
      )}
    </div>
  );
};

export default RecipesPageLoggedInView;
