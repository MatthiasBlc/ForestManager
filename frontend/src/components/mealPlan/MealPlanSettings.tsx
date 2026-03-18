import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import APIManager from "../../network/api";
import { MealPlan } from "../../models/mealPlan";

interface Props {
  communityId: string;
  plan: MealPlan;
  onUpdated: (plan: MealPlan) => void;
  onClose: () => void;
}

const MealPlanSettings = ({ communityId, plan, onUpdated, onClose }: Props) => {
  const [defaultServings, setDefaultServings] = useState(plan.defaultServings);
  const [editableByMembers, setEditableByMembers] = useState(plan.editableByMembers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await APIManager.updateMealPlan(communityId, {
        defaultServings,
        editableByMembers,
      });
      onUpdated(response.plan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    defaultServings !== plan.defaultServings || editableByMembers !== plan.editableByMembers;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg mb-4">Plan Settings</h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">Default servings</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            value={defaultServings}
            onChange={(e) => setDefaultServings(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={100}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              Applied to new slots
            </span>
          </label>
        </div>

        <div className="form-control mb-6">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={editableByMembers}
              onChange={(e) => setEditableByMembers(e.target.checked)}
            />
            <span className="label-text">Allow members to edit slots</span>
          </label>
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              When enabled, all community members can edit meal slots
            </span>
          </label>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !hasChanges}
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

export default MealPlanSettings;
