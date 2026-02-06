import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FaShare, FaTimes, FaUsers } from "react-icons/fa";
import APIManager from "../../network/api";
import { CommunityListItem } from "../../models/community";

interface ShareRecipeModalProps {
  recipeId: string;
  recipeTitle: string;
  currentCommunityId: string;
  onClose: () => void;
  onShared: (newRecipeId: string) => void;
}

export const ShareRecipeModal = ({
  recipeId,
  recipeTitle,
  currentCommunityId,
  onClose,
  onShared,
}: ShareRecipeModalProps) => {
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
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
        // Exclude current community AND communities where already shared
        const available = communitiesRes.data.filter(
          (c) => c.id !== currentCommunityId && !sharedIds.has(c.id)
        );
        setCommunities(available);
        setAllShared(available.length === 0 && communitiesRes.data.length > 1);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [recipeId, currentCommunityId]);

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

  const handleShare = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsSharing(true);
      setError(null);

      let lastRecipeId = "";
      for (const communityId of selectedIds) {
        const newRecipe = await APIManager.shareRecipe(recipeId, communityId);
        lastRecipeId = newRecipe.id;
      }

      toast.success("Recipe shared successfully");
      onShared(lastRecipeId);
    } catch (err) {
      console.error("Error sharing recipe:", err);
      setError(err instanceof Error ? err.message : "Failed to share recipe");
      setIsSharing(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle absolute right-2 top-2"
          onClick={onClose}
          disabled={isSharing}
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg flex items-center gap-2">
          <FaShare className="text-primary" />
          Share Recipe
        </h3>

        <p className="py-4 text-base-content/70">
          Share &quot;{recipeTitle}&quot; to another community. A copy will be
          created in each selected community.
        </p>

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
            <span>
              {allShared
                ? "This recipe is already shared to all your other communities."
                : "You are not a member of any other communities to share to."}
            </span>
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
                  disabled={isSharing}
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
            disabled={isSharing}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary gap-2"
            onClick={handleShare}
            disabled={isSharing || selectedIds.size === 0 || isLoading}
          >
            {isSharing ? (
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

export default ShareRecipeModal;
