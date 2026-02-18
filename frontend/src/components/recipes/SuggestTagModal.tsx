import { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import Modal from "../Modal";
import APIManager from "../../network/api";
import { ConflictError } from "../../errors/http_errors";

interface SuggestTagModalProps {
  recipeId: string;
  onClose: () => void;
  onSuggestionSubmitted: () => void;
}

const SuggestTagModal = ({
  recipeId,
  onClose,
  onSuggestionSubmitted,
}: SuggestTagModalProps) => {
  const [tagName, setTagName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = tagName.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await APIManager.createTagSuggestion(recipeId, tagName.trim());
      onSuggestionSubmitted();
    } catch (err) {
      if (err instanceof ConflictError) {
        setError("Ce tag a deja ete suggere sur cette recette");
      } else {
        setError(err instanceof Error ? err.message : "Failed to suggest tag");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} disableClickOutside={isSubmitting}>
      <h3 className="font-bold text-lg mb-4">Suggest a tag</h3>
      <p className="text-sm text-base-content/70 mb-4">
        Suggest a tag to add to this recipe. The owner will review your suggestion.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Tag name</span>
          </label>
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Enter tag name"
            className="input input-bordered w-full"
            disabled={isSubmitting}
            autoFocus
          />
        </div>

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
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <FaPaperPlane className="w-3 h-3" />
            )}
            Suggest tag
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SuggestTagModal;
