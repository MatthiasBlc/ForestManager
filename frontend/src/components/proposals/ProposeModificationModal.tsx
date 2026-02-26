import { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import Modal from "../Modal";
import APIManager from "../../network/api";
import IngredientList, { IngredientInput } from "../form/IngredientList";
import StepEditor from "../form/StepEditor";
import { RecipeIngredient, RecipeStep } from "../../models/recipe";

interface ProposeModificationModalProps {
  recipeId: string;
  currentTitle: string;
  currentSteps: RecipeStep[];
  currentServings: number;
  currentPrepTime: number | null;
  currentCookTime: number | null;
  currentRestTime: number | null;
  currentIngredients: RecipeIngredient[];
  onClose: () => void;
  onProposalSubmitted: () => void;
}

function recipeIngredientsToInputs(ingredients: RecipeIngredient[]): IngredientInput[] {
  return ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity ?? undefined,
    unitId: ing.unitId ?? undefined,
    ingredientId: ing.ingredientId,
  }));
}

const ProposeModificationModal = ({
  recipeId,
  currentTitle,
  currentSteps,
  currentServings,
  currentPrepTime,
  currentCookTime,
  currentRestTime,
  currentIngredients,
  onClose,
  onProposalSubmitted,
}: ProposeModificationModalProps) => {
  const [proposedTitle, setProposedTitle] = useState(currentTitle);
  const [proposedServings, setProposedServings] = useState(currentServings);
  const [proposedPrepTime, setProposedPrepTime] = useState(currentPrepTime != null ? String(currentPrepTime) : "");
  const [proposedCookTime, setProposedCookTime] = useState(currentCookTime != null ? String(currentCookTime) : "");
  const [proposedRestTime, setProposedRestTime] = useState(currentRestTime != null ? String(currentRestTime) : "");
  const [proposedSteps, setProposedSteps] = useState<{ instruction: string }[]>(
    () => currentSteps.map((s) => ({ instruction: s.instruction }))
  );
  const [proposedIngredients, setProposedIngredients] = useState<IngredientInput[]>(
    () => recipeIngredientsToInputs(currentIngredients)
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseTime = (val: string): number | null => {
    if (val.trim() === "") return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  const ingredientsChanged = JSON.stringify(
    proposedIngredients.filter((i) => i.name.trim()).map(({ name, quantity, unitId }) => ({ name, quantity, unitId }))
  ) !== JSON.stringify(
    currentIngredients.map((i) => ({ name: i.name, quantity: i.quantity ?? undefined, unitId: i.unitId ?? undefined }))
  );

  const stepsChanged = JSON.stringify(
    proposedSteps.map((s) => s.instruction)
  ) !== JSON.stringify(
    currentSteps.map((s) => s.instruction)
  );

  const titleChanged = proposedTitle !== currentTitle;
  const servingsChanged = proposedServings !== currentServings;
  const prepTimeChanged = parseTime(proposedPrepTime) !== currentPrepTime;
  const cookTimeChanged = parseTime(proposedCookTime) !== currentCookTime;
  const restTimeChanged = parseTime(proposedRestTime) !== currentRestTime;

  const hasChanges = titleChanged || servingsChanged || prepTimeChanged || cookTimeChanged || restTimeChanged || stepsChanged || ingredientsChanged;
  const validSteps = proposedSteps.filter((s) => s.instruction.trim().length > 0);
  const isValid = proposedTitle.trim().length > 0 && validSteps.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || !isValid) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const filteredIngredients = proposedIngredients
        .filter((ing) => ing.name.trim())
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity,
          unitId: ing.unitId,
        }));

      await APIManager.createProposal(recipeId, {
        proposedTitle: proposedTitle.trim(),
        proposedServings: proposedServings,
        proposedPrepTime: parseTime(proposedPrepTime),
        proposedCookTime: parseTime(proposedCookTime),
        proposedRestTime: parseTime(proposedRestTime),
        proposedSteps: validSteps.map((s) => ({ instruction: s.instruction.trim() })),
        proposedIngredients: filteredIngredients.length > 0 ? filteredIngredients : undefined,
      });
      onProposalSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} disableClickOutside={isSubmitting}>
      <h3 className="font-bold text-lg mb-4">Propose a modification</h3>
      <p className="text-sm text-base-content/70 mb-4">
        Suggest changes to this recipe. The owner can accept your proposal to update the recipe,
        or reject it to create a variant with your changes.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Title</span>
          </label>
          <input
            type="text"
            value={proposedTitle}
            onChange={(e) => setProposedTitle(e.target.value)}
            placeholder="Recipe title"
            className="input input-bordered w-full"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Servings</span>
          </label>
          <input
            type="number"
            value={proposedServings}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 100) setProposedServings(v);
            }}
            min={1}
            max={100}
            className="input input-bordered w-24"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Times (optional, in minutes)</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label py-1">
                <span className="label-text text-sm">Prep</span>
              </label>
              <input
                type="number"
                value={proposedPrepTime}
                onChange={(e) => setProposedPrepTime(e.target.value)}
                placeholder="min"
                min={0}
                max={10000}
                className="input input-bordered w-full input-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="label py-1">
                <span className="label-text text-sm">Cook</span>
              </label>
              <input
                type="number"
                value={proposedCookTime}
                onChange={(e) => setProposedCookTime(e.target.value)}
                placeholder="min"
                min={0}
                max={10000}
                className="input input-bordered w-full input-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="label py-1">
                <span className="label-text text-sm">Rest</span>
              </label>
              <input
                type="number"
                value={proposedRestTime}
                onChange={(e) => setProposedRestTime(e.target.value)}
                placeholder="min"
                min={0}
                max={10000}
                className="input input-bordered w-full input-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Steps</span>
          </label>
          <StepEditor value={proposedSteps} onChange={setProposedSteps} />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Ingredients</span>
          </label>
          <IngredientList
            value={proposedIngredients}
            onChange={setProposedIngredients}
          />
        </div>

        {!hasChanges && (
          <div className="alert alert-warning">
            <span>You need to make changes before submitting a proposal.</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSubmitting || !hasChanges || !isValid}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <FaPaperPlane className="w-3 h-3" />
            )}
            Submit proposal
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProposeModificationModal;
