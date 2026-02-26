import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaArrowLeft, FaEdit, FaTrash, FaLightbulb, FaShare, FaCodeBranch, FaTag } from "react-icons/fa";
import APIManager from "../network/api";
import { RecipeDetail } from "../models/recipe";
import { useAuth } from "../contexts/AuthContext";
import TagBadge from "../components/recipes/TagBadge";
import TimeBadges from "../components/recipes/TimeBadges";
import ServingsSelector from "../components/recipes/ServingsSelector";
import { formatDate } from "../utils/format.Date";
import { scaleQuantity } from "../utils/scaleQuantity";
import { ProposeModificationModal, ProposalsList, VariantsDropdown } from "../components/proposals";
import { ShareRecipeModal, SharePersonalRecipeModal } from "../components/share";
import SuggestTagModal from "../components/recipes/SuggestTagModal";
import TagSuggestionsList from "../components/recipes/TagSuggestionsList";

const RecipeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServings, setSelectedServings] = useState<number>(4);
  const [openModal, setOpenModal] = useState<"propose" | "share" | "publish" | "suggest-tag" | null>(null);
  const [proposalsRefresh, setProposalsRefresh] = useState(0);
  const [suggestionsRefresh, setSuggestionsRefresh] = useState(0);

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
        setSelectedServings(data.servings);
      } catch (err) {
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
        navigate(recipe.communityId ? `/communities/${recipe.communityId}` : "/recipes");
      } catch {
        toast.error("Failed to delete recipe");
      }
    }
  };

  const handleTagClick = (tagName: string) => {
    if (recipe?.communityId) {
      navigate(`/communities/${recipe.communityId}?tags=${encodeURIComponent(tagName)}`);
    } else {
      navigate(`/recipes?tags=${encodeURIComponent(tagName)}`);
    }
  };

  const loadRecipeData = async () => {
    if (!id) return;
    try {
      const data = await APIManager.getRecipe(id);
      setRecipe(data);
    } catch {
      // Reload failure is non-critical - current data remains displayed
    }
  };

  const handleProposalSubmitted = () => {
    setOpenModal(null);
    setProposalsRefresh((k) => k + 1);
    toast.success("Proposal submitted");
  };

  const handleProposalDecided = () => {
    loadRecipeData();
    setProposalsRefresh((k) => k + 1);
  };

  const handleSuggestionSubmitted = () => {
    setOpenModal(null);
    setSuggestionsRefresh((k) => k + 1);
    toast.success("Tag suggestion submitted");
  };

  const handleSuggestionDecided = () => {
    loadRecipeData();
    setSuggestionsRefresh((k) => k + 1);
  };

  const handleRecipeShared = (newRecipeId: string) => {
    setOpenModal(null);
    toast.success("Recipe shared successfully");
    navigate(`/recipes/${newRecipeId}`);
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
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
          Go back
        </button>
      </div>
    );
  }

  const dateText =
    recipe.updatedAt > recipe.createdAt
      ? `Updated: ${formatDate(recipe.updatedAt)}`
      : `Created: ${formatDate(recipe.createdAt)}`;

  const isOwner = recipe.creatorId === user?.id;
  const isCommunityRecipe = !!recipe.communityId;
  const canPropose = isCommunityRecipe && !isOwner;
  const canShare = isCommunityRecipe; // Backend validates MODERATOR or owner permission
  const canPublish = !isCommunityRecipe && isOwner; // Personal recipe, owner can publish to communities
  const isSharedRecipe = !!recipe.sharedFromCommunityId;
  const backPath = recipe.communityId ? `/communities/${recipe.communityId}` : "/recipes";
  const backLabel = recipe.communityId ? "Back to community" : "Back to recipes";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate(backPath)}
        >
          <FaArrowLeft />
          {backLabel}
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
            <div>
              <h1 className="text-3xl font-bold">{recipe.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {recipe.community && (
                  <button
                    className="badge badge-secondary cursor-pointer"
                    onClick={() => navigate(`/communities/${recipe.communityId}`)}
                  >
                    In: {recipe.community.name}
                  </button>
                )}
                {isSharedRecipe && (
                  <span className="badge badge-outline badge-info gap-1">
                    <FaCodeBranch className="w-3 h-3" />
                    {recipe.creator ? `Shared by: ${recipe.creator.username}` : "Shared from another community"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {isCommunityRecipe && (
                <VariantsDropdown recipeId={recipe.id} currentRecipeId={recipe.id} />
              )}
              {canPublish && (
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => setOpenModal("publish")}
                  aria-label="Share to community"
                >
                  <FaShare className="w-3 h-3" />
                  Share
                </button>
              )}
              {canShare && (
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => setOpenModal("share")}
                  aria-label="Share recipe"
                >
                  <FaShare className="w-3 h-3" />
                  Share
                </button>
              )}
              {canPropose && (
                <>
                  <button
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => setOpenModal("suggest-tag")}
                    aria-label="Suggest tag"
                  >
                    <FaTag className="w-3 h-3" />
                    Suggest tag
                  </button>
                  <button
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => setOpenModal("propose")}
                    aria-label="Propose changes"
                  >
                    <FaLightbulb className="w-3 h-3" />
                    Propose changes
                  </button>
                </>
              )}
              {isOwner && (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                    aria-label="Edit recipe"
                  >
                    <FaEdit />
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    onClick={handleDelete}
                    aria-label="Delete recipe"
                  >
                    <FaTrash />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-sm text-base-content/60 mb-4">{dateText}</p>

          <TimeBadges
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
            restTime={recipe.restTime}
          />

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 mb-6">
              {recipe.tags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="lg"
                  onClick={() => handleTagClick(tag.name)}
                />
              ))}
            </div>
          )}

          {recipe.ingredients.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Ingredients</h2>
                <ServingsSelector
                  baseServings={recipe.servings}
                  value={selectedServings}
                  onChange={setSelectedServings}
                />
              </div>
              <ul className="list-disc list-inside space-y-1 bg-base-200 p-4 rounded-lg">
                {recipe.ingredients.map((ing) => {
                  const scaledQty = scaleQuantity(ing.quantity, recipe.servings, selectedServings);
                  return (
                    <li key={ing.id} className="text-base-content">
                      <span className="font-medium">{ing.name}</span>
                      {scaledQty != null && (
                        <span className="text-base-content/70">
                          {" "}- {scaledQty}{ing.unit ? ` ${ing.unit.abbreviation}` : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="divider" />

          <div>
            <h2 className="text-xl font-semibold mb-4">Instructions</h2>
            <div className="space-y-4">
              {recipe.steps.map((step, i) => (
                <div key={step.id} className="flex gap-4 items-start">
                  <div className="badge badge-primary badge-lg">{i + 1}</div>
                  <p className="flex-1 whitespace-pre-wrap">{step.instruction}</p>
                </div>
              ))}
            </div>
          </div>

          {isOwner && isCommunityRecipe && (
            <>
              <div className="divider" />
              <ProposalsList
                recipeId={recipe.id}
                currentIngredients={recipe.ingredients}
                refreshSignal={proposalsRefresh}
                onProposalDecided={handleProposalDecided}
              />
              <TagSuggestionsList
                recipeId={recipe.id}
                refreshSignal={suggestionsRefresh}
                onSuggestionDecided={handleSuggestionDecided}
              />
            </>
          )}
        </div>
      </article>

      {openModal === "suggest-tag" && (
        <SuggestTagModal
          recipeId={recipe.id}
          onClose={() => setOpenModal(null)}
          onSuggestionSubmitted={handleSuggestionSubmitted}
        />
      )}

      {openModal === "propose" && (
        <ProposeModificationModal
          recipeId={recipe.id}
          currentTitle={recipe.title}
          currentSteps={recipe.steps}
          currentServings={recipe.servings}
          currentPrepTime={recipe.prepTime}
          currentCookTime={recipe.cookTime}
          currentRestTime={recipe.restTime}
          currentIngredients={recipe.ingredients}
          onClose={() => setOpenModal(null)}
          onProposalSubmitted={handleProposalSubmitted}
        />
      )}

      {openModal === "share" && recipe.communityId && (
        <ShareRecipeModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          currentCommunityId={recipe.communityId}
          onClose={() => setOpenModal(null)}
          onShared={handleRecipeShared}
        />
      )}

      {openModal === "publish" && (
        <SharePersonalRecipeModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          onClose={() => setOpenModal(null)}
          onPublished={() => setOpenModal(null)}
        />
      )}
    </div>
  );
};

export default RecipeDetailPage;
