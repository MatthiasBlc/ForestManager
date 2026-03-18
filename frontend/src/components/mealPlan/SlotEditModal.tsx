import { useState, useEffect } from "react";
import { FaTimes, FaSearch, FaLock, FaUnlock, FaBan, FaCheck } from "react-icons/fa";
import APIManager from "../../network/api";
import { MealSlot, MealSlotType, UpdateSlotInput } from "../../models/mealPlan";
import { RecipeListItem } from "../../models/recipe";

interface Props {
  communityId: string;
  slot: MealSlot;
  isModerator: boolean;
  onSaved: (slot: MealSlot) => void;
  onClose: () => void;
}

const SlotEditModal = ({ communityId, slot, isModerator, onSaved, onClose }: Props) => {
  const [mode, setMode] = useState<"recipe" | "freeText" | "empty">(
    slot.type === "RECIPE" ? "recipe" : slot.type === "FREE_TEXT" ? "freeText" : "empty"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeListItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<{ id: string; title: string } | null>(
    slot.recipe ? { id: slot.recipe.id, title: slot.recipe.title } : null
  );
  const [freeText, setFreeText] = useState(slot.freeText || "");
  const [comment, setComment] = useState(slot.comment || "");
  const [servings, setServings] = useState(slot.servings);
  const [disabled, setDisabled] = useState(slot.disabled);
  const [locked, setLocked] = useState(slot.locked);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search recipes
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await APIManager.getCommunityRecipes(communityId, {
          search: searchQuery,
          limit: 10,
        });
        setSearchResults(response.data);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, communityId]);

  const handleSelectRecipe = (recipe: RecipeListItem) => {
    setSelectedRecipe({ id: recipe.id, title: recipe.title });
    setMode("recipe");
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const update: UpdateSlotInput = {
        disabled,
        locked: isModerator ? locked : undefined,
        comment: comment || null,
        servings,
      };

      if (disabled) {
        // When disabled, just update disabled state
        update.type = slot.type;
      } else if (mode === "empty") {
        update.type = "EMPTY";
      } else if (mode === "recipe" && selectedRecipe) {
        update.type = "RECIPE";
        update.recipeId = selectedRecipe.id;
      } else if (mode === "freeText" && freeText) {
        update.type = "FREE_TEXT";
        update.freeText = freeText;
      }

      const updatedSlot = await APIManager.updateMealSlot(communityId, slot.id, update);
      onSaved(updatedSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update slot");
    } finally {
      setIsSubmitting(false);
    }
  };

  const mealTimeLabel = slot.mealTime === "LUNCH" ? "Lunch" : "Dinner";
  const dateLabel = new Date(slot.date).toLocaleDateString();

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg mb-1">Edit Slot</h3>
        <p className="text-sm text-base-content/60 mb-4">
          {mealTimeLabel} - {dateLabel}
        </p>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* Disabled toggle */}
        <div className="form-control mb-4">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
            <span className="label-text flex items-center gap-2">
              <FaBan className="w-4 h-4" />
              Disabled (skip this slot)
            </span>
          </label>
        </div>

        {!disabled && (
          <>
            {/* Mode selector */}
            <div className="tabs tabs-boxed mb-4">
              <button
                className={`tab ${mode === "recipe" ? "tab-active" : ""}`}
                onClick={() => setMode("recipe")}
              >
                Recipe
              </button>
              <button
                className={`tab ${mode === "freeText" ? "tab-active" : ""}`}
                onClick={() => setMode("freeText")}
              >
                Free text
              </button>
              <button
                className={`tab ${mode === "empty" ? "tab-active" : ""}`}
                onClick={() => setMode("empty")}
              >
                Empty
              </button>
            </div>

            {/* Recipe search */}
            {mode === "recipe" && (
              <div className="mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Search recipe</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input input-bordered w-full pl-10"
                      placeholder="Search community recipes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    {isSearching && (
                      <span className="loading loading-spinner loading-sm absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-base-200 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((recipe) => (
                      <button
                        key={recipe.id}
                        className="w-full p-2 text-left hover:bg-base-300 flex items-center justify-between"
                        onClick={() => handleSelectRecipe(recipe)}
                      >
                        <span className="truncate">{recipe.title}</span>
                        {selectedRecipe?.id === recipe.id && (
                          <FaCheck className="w-4 h-4 text-success flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected recipe */}
                {selectedRecipe && (
                  <div className="mt-2 p-2 bg-primary/10 rounded-lg flex items-center justify-between">
                    <span className="font-medium">{selectedRecipe.title}</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setSelectedRecipe(null)}
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Free text input */}
            {mode === "freeText" && (
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Meal name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="e.g., Takeout, Leftovers..."
                  maxLength={255}
                />
              </div>
            )}

            {/* Comment */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Comment (optional)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Notes about this meal..."
                maxLength={500}
                rows={2}
              />
            </div>

            {/* Servings */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Servings</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-32"
                value={servings}
                onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={100}
              />
            </div>
          </>
        )}

        {/* Locked toggle (moderator only) */}
        {isModerator && (
          <div className="form-control mb-4">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="toggle toggle-warning"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              <span className="label-text flex items-center gap-2">
                {locked ? <FaLock className="w-4 h-4" /> : <FaUnlock className="w-4 h-4" />}
                Locked (only moderators can edit)
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || (!disabled && mode === "recipe" && !selectedRecipe) || (!disabled && mode === "freeText" && !freeText)}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default SlotEditModal;
