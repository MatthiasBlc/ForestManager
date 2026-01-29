import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import APIManager from "../network/api";
import { RecipeDetail } from "../models/recipe";
import { formatDate } from "../utils/format.Date";

const RecipeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecipe() {
      if (!id) {
        setError("Recipe ID is missing");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await APIManager.getRecipe(id);
        setRecipe(data);
      } catch (err) {
        console.error("Error loading recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (!recipe) return;

    if (window.confirm("Are you sure you want to delete this recipe?")) {
      try {
        await APIManager.deleteRecipe(recipe.id);
        navigate("/recipes");
      } catch (err) {
        console.error("Error deleting recipe:", err);
        alert("Failed to delete recipe");
      }
    }
  };

  const handleTagClick = (tagName: string) => {
    navigate(`/recipes?tags=${encodeURIComponent(tagName)}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{error || "Recipe not found"}</span>
        </div>
        <button
          className="btn btn-ghost mt-4 gap-2"
          onClick={() => navigate("/recipes")}
        >
          <FaArrowLeft />
          Back to recipes
        </button>
      </div>
    );
  }

  const dateText =
    recipe.updatedAt > recipe.createdAt
      ? `Updated: ${formatDate(recipe.updatedAt)}`
      : `Created: ${formatDate(recipe.createdAt)}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate("/recipes")}
        >
          <FaArrowLeft />
          Back to recipes
        </button>
      </div>

      <article className="bg-base-100 rounded-lg shadow-xl overflow-hidden">
        {recipe.imageUrl && (
          <figure className="h-64 md:h-96 overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </figure>
        )}

        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start gap-4 mb-4">
            <h1 className="text-3xl font-bold">{recipe.title}</h1>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
              >
                <FaEdit />
                Edit
              </button>
              <button
                className="btn btn-ghost btn-sm text-error"
                onClick={handleDelete}
              >
                <FaTrash />
                Delete
              </button>
            </div>
          </div>

          <p className="text-sm text-base-content/60 mb-4">{dateText}</p>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {recipe.tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.name)}
                  className="badge badge-primary badge-lg cursor-pointer hover:badge-secondary"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {recipe.ingredients.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-3">Ingredients</h2>
              <ul className="list-disc list-inside space-y-1 bg-base-200 p-4 rounded-lg">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="text-base-content">
                    <span className="font-medium">{ing.name}</span>
                    {ing.quantity && (
                      <span className="text-base-content/70"> - {ing.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="divider" />

          <div className="prose max-w-none">
            <h2 className="text-xl font-semibold mb-3">Instructions</h2>
            <div className="whitespace-pre-wrap">{recipe.content}</div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default RecipeDetailPage;
