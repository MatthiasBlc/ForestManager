import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FaShare, FaTimes, FaUsers } from "react-icons/fa";
import APIManager from "../../network/api";
import { CommunityListItem } from "../../models/community";

interface ShareModalBaseProps {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
}

interface CommunityShareProps extends ShareModalBaseProps {
  mode: "community";
  currentCommunityId: string;
  onShared: (newRecipeId: string) => void;
}

interface PersonalShareProps extends ShareModalBaseProps {
  mode: "personal";
  onPublished: () => void;
}

type ShareModalProps = CommunityShareProps | PersonalShareProps;

export const ShareModal = (props: ShareModalProps) => {
  const { recipeId, recipeTitle, onClose, mode } = props;

  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShared, setAllShared] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [communitiesRes, sharedRes] = await Promise.all([
          APIManager.getCommunities(),
          APIManager.getRecipeCommunities(recipeId),
        ]);

        const sharedIds = new Set(sharedRes.data.map((c) => c.id));

        const available = communitiesRes.data.filter((c) => {
          if (sharedIds.has(c.id)) return false;
          if (mode === "community") return c.id !== (props as CommunityShareProps).currentCommunityId;
          return true;
        });

        setCommunities(available);
        setAllShared(available.length === 0 && communitiesRes.data.length > (mode === "community" ? 1 : 0));
      } catch {
        setError("Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [recipeId, mode, mode === "community" ? (props as CommunityShareProps).currentCommunityId : null]);

  const toggleCommunity = (communityId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(communityId)) {
        next.delete(communityId);
      } else {
        next.add(communityId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === "community") {
        let lastRecipeId = "";
        for (const communityId of selectedIds) {
          const newRecipe = await APIManager.shareRecipe(recipeId, communityId);
          lastRecipeId = newRecipe.id;
        }
        toast.success("Recipe shared successfully");
        (props as CommunityShareProps).onShared(lastRecipeId);
      } else {
        await APIManager.publishToCommunities(recipeId, Array.from(selectedIds));
        toast.success("Recipe shared to communities");
        (props as PersonalShareProps).onPublished();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share recipe");
      setIsSubmitting(false);
    }
  };

  const title = mode === "community" ? "Share Recipe" : "Share to Communities";
  const description = mode === "community"
    ? `Share "${recipeTitle}" to another community. A copy will be created in each selected community.`
    : `Share "${recipeTitle}" to your communities. A copy will be created in each selected community.`;
  const emptyMessage = allShared
    ? (mode === "community"
        ? "This recipe is already shared to all your other communities."
        : "This recipe is already shared to all your communities.")
    : (mode === "community"
        ? "You are not a member of any other communities to share to."
        : "You are not a member of any communities yet.");

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle absolute right-2 top-2"
          onClick={onClose}
          disabled={isSubmitting}
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg flex items-center gap-2">
          <FaShare className="text-primary" />
          {title}
        </h3>

        <p className="py-4 text-base-content/70">{description}</p>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : communities.length === 0 ? (
          <div className="alert alert-info">
            <FaUsers className="w-4 h-4" />
            <span>{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {communities.map((community) => (
              <label
                key={community.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={selectedIds.has(community.id)}
                  onChange={() => toggleCommunity(community.id)}
                  disabled={isSubmitting}
                />
                <div className="flex-1">
                  <p className="font-medium">{community.name}</p>
                  <p className="text-xs text-base-content/50">
                    {community.membersCount} {community.membersCount === 1 ? "member" : "members"}
                    {community.role === "MODERATOR" && " \u00b7 Moderator"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedIds.size === 0 || isLoading}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sharing...
              </>
            ) : (
              <>
                <FaShare className="w-4 h-4" />
                Share to {selectedIds.size} {selectedIds.size === 1 ? "community" : "communities"}
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

// Backwards-compatible named exports for existing callers
export const ShareRecipeModal = (props: Omit<CommunityShareProps, "mode">) => (
  <ShareModal {...props} mode="community" />
);

export const SharePersonalRecipeModal = (props: Omit<PersonalShareProps, "mode">) => (
  <ShareModal {...props} mode="personal" />
);
