import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import APIManager, { RecipeInput } from "../network/api";
import TagSelector from "../components/form/TagSelector";
import IngredientList, { IngredientInput } from "../components/form/IngredientList";
import StepEditor from "../components/form/StepEditor";

interface FormData {
  title: string;
  imageUrl: string;
}

const RecipeFormPage = () => {
  const { id, communityId } = useParams<{ id: string; communityId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
  const [servings, setServings] = useState<number>(4);
  const [prepTime, setPrepTime] = useState<string>("");
  const [cookTime, setCookTime] = useState<string>("");
  const [restTime, setRestTime] = useState<string>("");
  const [steps, setSteps] = useState<{ instruction: string }[]>([{ instruction: "" }]);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
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
          imageUrl: recipe.imageUrl || "",
        });
        setServings(recipe.servings);
        setPrepTime(recipe.prepTime != null ? String(recipe.prepTime) : "");
        setCookTime(recipe.cookTime != null ? String(recipe.cookTime) : "");
        setRestTime(recipe.restTime != null ? String(recipe.restTime) : "");
        setSteps(recipe.steps.map((s) => ({ instruction: s.instruction })));
        setTags(recipe.tags.map((t) => t.name));
        setIngredients(
          recipe.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity ?? undefined,
            unitId: ing.unitId ?? undefined,
            ingredientId: ing.ingredientId,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecipe();
  }, [id, reset]);

  const parseOptionalTime = (value: string): number | undefined => {
    if (value.trim() === "") return undefined;
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  };

  const onSubmit = async (data: FormData) => {
    const validSteps = steps.filter((s) => s.instruction.trim().length > 0);
    if (validSteps.length === 0) {
      setStepsError("At least one step is required");
      return;
    }
    setStepsError(null);

    try {
      const recipeData: RecipeInput = {
        title: data.title.trim(),
        servings,
        prepTime: parseOptionalTime(prepTime),
        cookTime: parseOptionalTime(cookTime),
        restTime: parseOptionalTime(restTime),
        steps: validSteps.map((s) => ({ instruction: s.instruction.trim() })),
        imageUrl: data.imageUrl.trim() || undefined,
        tags: tags,
        ingredients: ingredients
          .filter((ing) => ing.name.trim())
          .map((ing) => ({
            name: ing.name.trim(),
            quantity: ing.quantity,
            unitId: ing.unitId,
          })),
      };

      if (isEditing && id) {
        await APIManager.updateRecipe(id, recipeData);
        navigate(`/recipes/${id}`);
      } else if (communityId) {
        const newCommunityRecipe = await APIManager.createCommunityRecipe(communityId, recipeData);
        navigate(`/recipes/${newCommunityRecipe.id}`);
      } else {
        const newRecipe = await APIManager.createRecipe(recipeData);
        navigate(`/recipes/${newRecipe.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recipe");
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
        <button className="btn btn-ghost mt-4 gap-2" onClick={() => navigate(communityId ? `/communities/${communityId}` : "/recipes")}>
          <FaArrowLeft />
          {communityId ? "Back to community" : "Back to recipes"}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => {
            if (isEditing && id) navigate(`/recipes/${id}`);
            else if (communityId) navigate(`/communities/${communityId}`);
            else navigate("/recipes");
          }}
        >
          <FaArrowLeft />
          {isEditing ? "Back to recipe" : communityId ? "Back to community" : "Back to recipes"}
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
              <span className="label-text font-medium">Servings *</span>
            </label>
            <input
              type="number"
              value={servings}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 100) setServings(v);
              }}
              min={1}
              max={100}
              className="input input-bordered w-24"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Times (optional, in minutes)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label py-1">
                  <span className="label-text text-sm">Prep</span>
                </label>
                <input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="min"
                  min={0}
                  max={10000}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label py-1">
                  <span className="label-text text-sm">Cook</span>
                </label>
                <input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="min"
                  min={0}
                  max={10000}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label py-1">
                  <span className="label-text text-sm">Rest</span>
                </label>
                <input
                  type="number"
                  value={restTime}
                  onChange={(e) => setRestTime(e.target.value)}
                  placeholder="min"
                  min={0}
                  max={10000}
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Tags</span>
            </label>
            <TagSelector value={tags} onChange={setTags} allowCreate={true} communityId={communityId} />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Ingredients</span>
            </label>
            <IngredientList value={ingredients} onChange={setIngredients} />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Steps *</span>
            </label>
            <StepEditor value={steps} onChange={setSteps} />
            {stepsError && (
              <label className="label">
                <span className="label-text-alt text-error">{stepsError}</span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (isEditing && id) navigate(`/recipes/${id}`);
                else if (communityId) navigate(`/communities/${communityId}`);
                else navigate("/recipes");
              }}
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
