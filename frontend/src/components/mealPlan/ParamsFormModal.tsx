import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { MealGenerationParamsListItem } from "../../models/mealPlan";

interface ParamsFormData {
  name: string;
  description: string | null;
  cooldownDays: number;
  useIdeas: boolean;
  isDefault: boolean;
}

interface Props {
  params: MealGenerationParamsListItem | null; // null = create mode
  onSubmit: (data: ParamsFormData) => Promise<void>;
  onClose: () => void;
}

const ParamsFormModal = ({ params, onSubmit, onClose }: Props) => {
  const isEdit = !!params;
  const [name, setName] = useState(params?.name || "");
  const [description, setDescription] = useState(params?.description || "");
  const [cooldownDays, setCooldownDays] = useState(params?.cooldownDays ?? 3);
  const [useIdeas, setUseIdeas] = useState(params?.useIdeas ?? true);
  const [isDefault, setIsDefault] = useState(params?.isDefault ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        cooldownDays,
        useIdeas,
        isDefault,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Edit Parameters" : "New Parameter Set"}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text">Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard, Summer, Diet..."
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Cooldown days */}
          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text">Recipe cooldown (days)</span>
              <span className="label-text-alt">Min days before a recipe repeats</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-32"
              value={cooldownDays}
              onChange={(e) => setCooldownDays(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
            />
          </div>

          {/* Use ideas */}
          <div className="form-control mb-3">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="toggle"
                checked={useIdeas}
                onChange={(e) => setUseIdeas(e.target.checked)}
              />
              <span className="label-text">Include meal ideas in generation pool</span>
            </label>
          </div>

          {/* Is default */}
          <div className="form-control mb-4">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="toggle toggle-warning"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span className="label-text">Set as default parameter set</span>
            </label>
            <p className="text-xs text-base-content/50 ml-14">
              Only one set can be default. Used for quick slot replacement.
            </p>
          </div>

          {/* Actions */}
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
              className="btn btn-primary"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : isEdit ? (
                "Save"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default ParamsFormModal;
