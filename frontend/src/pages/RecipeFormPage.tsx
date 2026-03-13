import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave, FaFileImport } from "react-icons/fa";
import APIManager, { RecipeInput } from "../network/api";
import TagSelector from "../components/form/TagSelector";
import IngredientList, { IngredientInput } from "../components/form/IngredientList";
import StepEditor from "../components/form/StepEditor";
import ImageUpload from "../components/ImageUpload";
import ImagePicker from "../components/ImagePicker";
import ImportRecipeModal from "../components/ImportRecipeModal";
import { useImageUpload } from "../hooks/useImageUpload";
import { ParsedRecipe } from "../services/recipeParser";
import { Unit } from "../models/recipe";

interface FormData {
  title: string;
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
    currentImageUrl,
    setCurrentImageUrl,
    pendingImage,
    setPendingImage,
    isUploadingImage,
    uploadPendingImage,
    getUploadUrl,
    confirmUpload,
    deleteImage,
  } = useImageUpload("recipe");
  const [showImportModal, setShowImportModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
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
        });
        setCurrentImageUrl(recipe.imageUrl || null);
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

  const parseOptionalTime = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
  };

  const handleImport = useCallback(
    async (parsed: ParsedRecipe) => {
      // Verification avant ecrasement
      const currentTitle = getValues("title")?.trim();
      const hasData =
        (currentTitle && currentTitle.length > 0) ||
        tags.length > 0 ||
        ingredients.some((i) => i.name.trim()) ||
        steps.some((s) => s.instruction.trim());

      if (hasData) {
        const confirmed = window.confirm(
          "Le formulaire contient deja des donnees. L'import va remplacer les champs detectes. Continuer ?"
        );
        if (!confirmed) return;
      }

      setShowImportModal(false);

      // Pre-remplir les champs simples
      if (parsed.title) reset({ title: parsed.title });
      if (parsed.servings != null) setServings(parsed.servings);
      if (parsed.prepTime != null) setPrepTime(String(parsed.prepTime));
      if (parsed.cookTime != null) setCookTime(String(parsed.cookTime));
      if (parsed.restTime != null) setRestTime(String(parsed.restTime));
      if (parsed.steps.length > 0) {
        setSteps(parsed.steps.map((s) => ({ instruction: s })));
      }

      // Matching des ingredients
      if (parsed.ingredients.length > 0) {
        try {
          // Charger les unites pour le matching
          const unitsByCategory = await APIManager.getUnits();
          const allUnits: Unit[] = Object.values(unitsByCategory).flat();

          // Matcher chaque ingredient en parallele
          const mapped = await Promise.all(
            parsed.ingredients.map(async (pi): Promise<IngredientInput> => {
              const name = pi.name ?? pi.raw;

              // Matcher l'unite par abbreviation
              let unitId: string | undefined;
              if (pi.unitAbbreviation) {
                const matchedUnit = allUnits.find(
                  (u) => u.abbreviation.toLowerCase() === pi.unitAbbreviation!.toLowerCase()
                );
                if (matchedUnit) unitId = matchedUnit.id;
              }

              // Matcher l'ingredient par nom exact
              let ingredientId: string | undefined;
              if (name) {
                try {
                  const results = await APIManager.searchIngredients(name, 5);
                  const exact = results.find((r) => r.name.toLowerCase() === name.toLowerCase());
                  if (exact) {
                    ingredientId = exact.id;
                    // Si pas d'unite matchee, tenter la suggestion
                    if (!unitId) {
                      try {
                        const suggested = await APIManager.getSuggestedUnit(exact.id);
                        if (suggested.suggestedUnitId) unitId = suggested.suggestedUnitId;
                      } catch {
                        /* ignore */
                      }
                    }
                  }
                } catch {
                  /* ignore search errors */
                }
              }

              return {
                name,
                quantity: pi.quantity ?? undefined,
                unitId,
                ingredientId,
              };
            })
          );

          setIngredients(mapped);
        } catch {
          // Fallback sans matching
          setIngredients(
            parsed.ingredients.map((pi) => ({
              name: pi.name ?? pi.raw,
              quantity: pi.quantity ?? undefined,
            }))
          );
        }
      }

      // Toast de succes
      const parts: string[] = [];
      if (parsed.title) parts.push("titre");
      if (parsed.ingredients.length > 0) parts.push(`${parsed.ingredients.length} ingredients`);
      if (parsed.steps.length > 0) parts.push(`${parsed.steps.length} etapes`);
      toast.success(`Import reussi : ${parts.join(", ")} detectes`);
    },
    [tags, ingredients, steps, reset, getValues]
  );

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
        if (pendingImage) {
          await uploadPendingImage(newCommunityRecipe.id);
        }
        navigate(`/recipes/${newCommunityRecipe.id}`);
      } else {
        const newRecipe = await APIManager.createRecipe(recipeData);
        if (pendingImage) {
          await uploadPendingImage(newRecipe.id);
        }
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
        <button
          className="btn btn-ghost mt-4 gap-2"
          onClick={() => navigate(communityId ? `/communities/${communityId}` : "/recipes")}
        >
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{isEditing ? "Edit Recipe" : "New Recipe"}</h1>
          {!isEditing && (
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              onClick={() => setShowImportModal(true)}
            >
              <FaFileImport />
              Importer une recette
            </button>
          )}
        </div>

        {showImportModal && (
          <ImportRecipeModal onImport={handleImport} onClose={() => setShowImportModal(false)} />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Title *</span>
            </label>
            <input
              type="text"
              {...register("title", {
                required: "Title is required",
                maxLength: { value: 200, message: "Title must be 200 characters or less" },
              })}
              placeholder="Recipe title"
              maxLength={200}
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
              <span className="label-text font-medium">Photo</span>
            </label>
            {isEditing && id ? (
              <ImageUpload
                currentImageUrl={currentImageUrl}
                onUploadComplete={(imageUrl) => setCurrentImageUrl(imageUrl)}
                onDeleteComplete={() => setCurrentImageUrl(null)}
                getUploadUrl={() => getUploadUrl(id)}
                confirmUpload={() => confirmUpload(id)}
                deleteImage={() => deleteImage(id)}
              />
            ) : (
              <ImagePicker onImageSelected={setPendingImage} />
            )}
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
            <TagSelector
              value={tags}
              onChange={setTags}
              allowCreate={true}
              communityId={communityId}
            />
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
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={isSubmitting || isUploadingImage}
            >
              {isSubmitting || isUploadingImage ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <FaSave />
              )}
              {isUploadingImage
                ? "Uploading image..."
                : isEditing
                  ? "Save changes"
                  : "Create recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeFormPage;
