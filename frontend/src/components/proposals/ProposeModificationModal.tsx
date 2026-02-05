import { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import Modal from "../Modal";
import APIManager from "../../network/api";

interface ProposeModificationModalProps {
  recipeId: string;
  currentTitle: string;
  currentContent: string;
  onClose: () => void;
  onProposalSubmitted: () => void;
}

const ProposeModificationModal = ({
  recipeId,
  currentTitle,
  currentContent,
  onClose,
  onProposalSubmitted,
}: ProposeModificationModalProps) => {
  const [proposedTitle, setProposedTitle] = useState(currentTitle);
  const [proposedContent, setProposedContent] = useState(currentContent);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanges = proposedTitle !== currentTitle || proposedContent !== currentContent;
  const isValid = proposedTitle.trim().length > 0 && proposedContent.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || !isValid) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await APIManager.createProposal(recipeId, {
        proposedTitle: proposedTitle.trim(),
        proposedContent: proposedContent.trim(),
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
            <span className="label-text">Content / Instructions</span>
          </label>
          <textarea
            value={proposedContent}
            onChange={(e) => setProposedContent(e.target.value)}
            placeholder="Recipe content and instructions"
            className="textarea textarea-bordered w-full h-48"
            disabled={isSubmitting}
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
