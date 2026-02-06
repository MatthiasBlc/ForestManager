import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FaShare, FaTimes, FaUsers } from "react-icons/fa";
import APIManager from "../../network/api";
import { CommunityListItem } from "../../models/community";

interface SharePersonalRecipeModalProps {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
  onPublished: () => void;
}

export const SharePersonalRecipeModal = ({
  recipeId,
  recipeTitle,
  onClose,
  onPublished,
}: SharePersonalRecipeModalProps) => {
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [alreadySharedIds, setAlreadySharedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [communitiesRes, sharedRes] = await Promise.all([
          APIManager.getCommunities(),
          APIManager.getRecipeCommunities(recipeId),
        ]);

        const sharedIds = new Set(sharedRes.data.map((c) => c.id));
        setAlreadySharedIds(sharedIds);

        // Only show communities where recipe is NOT already shared
        const available = communitiesRes.data.filter((c) => !sharedIds.has(c.id));
        setCommunities(available);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [recipeId]);

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

  const handlePublish = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsPublishing(true);
      setError(null);
      await APIManager.publishToCommunities(recipeId, Array.from(selectedIds));
      toast.success("Recipe shared to communities");
      onPublished();
    } catch (err) {
      console.error("Error publishing recipe:", err);
      setError(err instanceof Error ? err.message : "Failed to publish recipe");
      setIsPublishing(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle absolute right-2 top-2"
          onClick={onClose}
          disabled={isPublishing}
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg flex items-center gap-2">
          <FaShare className="text-primary" />
          Share to Communities
        </h3>

        <p className="py-4 text-base-content/70">
          Share &quot;{recipeTitle}&quot; to your communities. A copy will be
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
              {alreadySharedIds.size > 0
                ? "This recipe is already shared to all your communities."
                : "You are not a member of any communities yet."}
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
                  disabled={isPublishing}
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
            disabled={isPublishing}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary gap-2"
            onClick={handlePublish}
            disabled={isPublishing || selectedIds.size === 0 || isLoading}
          >
            {isPublishing ? (
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

export default SharePersonalRecipeModal;
