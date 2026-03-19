import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaSearch, FaLink } from "react-icons/fa";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";
import APIManager from "../../network/api";
import { useAsyncData } from "../../hooks/useAsyncData";
import { MealIdea, MealIdeaInput } from "../../models/mealPlan";
import { Link } from "react-router-dom";

interface Props {
  communityId: string;
}

const MealIdeasPanel = ({ communityId }: Props) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<MealIdea | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data: ideas,
    setData: setIdeas,
    isLoading,
    error,
  } = useAsyncData(
    () =>
      APIManager.getMealIdeas(communityId, {
        search: debouncedSearch || undefined,
        limit: 50,
      }).then((r) => r.data),
    [communityId, debouncedSearch]
  );

  const handleCreateIdea = async (input: MealIdeaInput) => {
    try {
      const newIdea = await APIManager.createMealIdea(communityId, input);
      setIdeas([newIdea, ...(ideas || [])]);
      setShowForm(false);
      toast.success("Idea added");
    } catch (err) {
      toastError(err, "Failed to create idea");
    }
  };

  const handleUpdateIdea = async (ideaId: string, input: Partial<MealIdeaInput>) => {
    try {
      const updatedIdea = await APIManager.updateMealIdea(communityId, ideaId, input);
      setIdeas(ideas?.map((i) => (i.id === ideaId ? updatedIdea : i)) || null);
      setEditingIdea(null);
      toast.success("Idea updated");
    } catch (err) {
      toastError(err, "Failed to update idea");
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    if (!confirm("Delete this idea?")) return;

    setDeletingId(ideaId);
    try {
      await APIManager.deleteMealIdea(communityId, ideaId);
      setIdeas(ideas?.filter((i) => i.id !== ideaId) || null);
      toast.success("Idea deleted");
    } catch (err) {
      toastError(err, "Failed to delete idea");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header with search and add button */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            className="input input-bordered w-full pl-10"
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
        </div>
        <button className="btn btn-primary gap-2" onClick={() => setShowForm(true)}>
          <FaPlus />
          Add Idea
        </button>
      </div>

      {/* Ideas list */}
      {ideas && ideas.length > 0 ? (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isDeleting={deletingId === idea.id}
              onEdit={() => setEditingIdea(idea)}
              onDelete={() => handleDeleteIdea(idea.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-base-content/60">
          <p>No meal ideas yet.</p>
          <p className="text-sm mt-1">Add ideas for future meals to help with planning.</p>
        </div>
      )}

      {/* Create/Edit form modal */}
      {(showForm || editingIdea) && (
        <IdeaFormModal
          idea={editingIdea}
          onSubmit={(input) =>
            editingIdea ? handleUpdateIdea(editingIdea.id, input) : handleCreateIdea(input)
          }
          onClose={() => {
            setShowForm(false);
            setEditingIdea(null);
          }}
        />
      )}
    </div>
  );
};

// Idea card component
interface IdeaCardProps {
  idea: MealIdea;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const IdeaCard = ({ idea, isDeleting, onEdit, onDelete }: IdeaCardProps) => {
  return (
    <div className="p-4 bg-base-200 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium">{idea.name}</h4>
          {idea.comment && <p className="text-sm text-base-content/60 mt-1">{idea.comment}</p>}
          {idea.recipe && (
            <Link
              to={`/recipes/${idea.recipe.id}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            >
              <FaLink className="w-3 h-3" />
              {idea.recipe.title}
            </Link>
          )}
          {idea.createdBy && (
            <p className="text-xs text-base-content/40 mt-2">Added by {idea.createdBy.username}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            <FaEdit className="w-4 h-4" />
          </button>
          <button
            className="btn btn-ghost btn-sm text-error"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FaTrash className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Idea form modal
interface IdeaFormModalProps {
  idea: MealIdea | null;
  onSubmit: (input: MealIdeaInput) => void;
  onClose: () => void;
}

const IdeaFormModal = ({ idea, onSubmit, onClose }: IdeaFormModalProps) => {
  const [name, setName] = useState(idea?.name || "");
  const [comment, setComment] = useState(idea?.comment || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onSubmit({ name: name.trim(), comment: comment.trim() || undefined });
    setIsSubmitting(false);
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{idea ? "Edit Idea" : "Add Idea"}</h3>

        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Grandma's pasta recipe"
            maxLength={255}
            autoFocus
          />
        </div>

        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">Comment (optional)</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Notes, links, etc."
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : idea ? (
              "Update"
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default MealIdeasPanel;
