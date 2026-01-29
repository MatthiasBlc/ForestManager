import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import APIManager, { RecipeInput } from "../network/api";
import TagSelector from "../components/form/TagSelector";
import IngredientList, { IngredientInput } from "../components/form/IngredientList";

interface FormData {
  title: string;
  content: string;
  imageUrl: string;
}

const RecipeFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      content: "",
      imageUrl: "",
    },
  });

  useEffect(() => {
    async function loadRecipe() {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);
        const recipe = await APIManager.getRecipe(id);
        reset({
          title: recipe.title,
          content: recipe.content,
          imageUrl: recipe.imageUrl || "",
        });
        setTags(recipe.tags.map((t) => t.name));
        setIngredients(
          recipe.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity || "",
          }))
        );
      } catch (err) {
        console.error("Error loading recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecipe();
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const recipeData: RecipeInput = {
        title: data.title.trim(),
        content: data.content.trim(),
        imageUrl: data.imageUrl.trim() || undefined,
        tags: tags,
        ingredients: ingredients
          .filter((ing) => ing.name.trim())
          .map((ing) => ({
            name: ing.name.trim(),
            quantity: ing.quantity.trim() || undefined,
          })),
      };

      if (isEditing && id) {
        await APIManager.updateRecipe(id, recipeData);
        navigate(`/recipes/${id}`);
      } else {
        const newRecipe = await APIManager.createRecipe(recipeData);
        navigate(`/recipes/${newRecipe.id}`);
      }
    } catch (err) {
      console.error("Error saving recipe:", err);
      alert(err instanceof Error ? err.message : "Failed to save recipe");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
        <button className="btn btn-ghost mt-4 gap-2" onClick={() => navigate("/recipes")}>
          <FaArrowLeft />
          Back to recipes
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate(isEditing && id ? `/recipes/${id}` : "/recipes")}
        >
          <FaArrowLeft />
          {isEditing ? "Back to recipe" : "Back to recipes"}
        </button>
      </div>

      <div className="bg-base-100 rounded-lg shadow-xl p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">{isEditing ? "Edit Recipe" : "New Recipe"}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Title *</span>
            </label>
            <input
              type="text"
              {...register("title", { required: "Title is required" })}
              placeholder="Recipe title"
              className={`input input-bordered w-full ${errors.title ? "input-error" : ""}`}
            />
            {errors.title && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.title.message}</span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Image URL (optional)</span>
            </label>
            <input
              type="url"
              {...register("imageUrl")}
              placeholder="https://example.com/image.jpg"
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Tags</span>
            </label>
            <TagSelector value={tags} onChange={setTags} allowCreate={true} />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Ingredients</span>
            </label>
            <IngredientList value={ingredients} onChange={setIngredients} />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Instructions *</span>
            </label>
            <textarea
              {...register("content", { required: "Instructions are required" })}
              placeholder="Write your recipe instructions here..."
              rows={10}
              className={`textarea textarea-bordered w-full ${
                errors.content ? "textarea-error" : ""
              }`}
            />
            {errors.content && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.content.message}</span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(isEditing && id ? `/recipes/${id}` : "/recipes")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary gap-2" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : <FaSave />}
              {isEditing ? "Save changes" : "Create recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeFormPage;
