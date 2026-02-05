import { useState, useEffect } from "react";
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
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCommunities() {
      try {
        setIsLoading(true);
        const response = await APIManager.getCommunities();
        // Filter out the current community
        const otherCommunities = response.data.filter(
          (c) => c.id !== currentCommunityId
        );
        setCommunities(otherCommunities);
      } catch (err) {
        console.error("Error loading communities:", err);
        setError("Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    }

    loadCommunities();
  }, [currentCommunityId]);

  const handleShare = async () => {
    if (!selectedCommunityId) {
      setError("Please select a community");
      return;
    }

    try {
      setIsSharing(true);
      setError(null);
      const newRecipe = await APIManager.shareRecipe(recipeId, selectedCommunityId);
      onShared(newRecipe.id);
    } catch (err) {
      console.error("Error sharing recipe:", err);
      setError(err instanceof Error ? err.message : "Failed to share recipe");
      setIsSharing(false);
    }
  };

  const selectedCommunity = communities.find((c) => c.id === selectedCommunityId);

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
          Share "{recipeTitle}" to another community you belong to. A copy will be
          created in the target community.
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
            <span>You are not a member of any other communities to share to.</span>
          </div>
        ) : (
          <div className="form-control">
            <label className="label">
              <span className="label-text">Select target community</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedCommunityId}
              onChange={(e) => setSelectedCommunityId(e.target.value)}
              disabled={isSharing}
            >
              <option value="">Choose a community...</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                  {community.role === "MODERATOR" && " (Moderator)"}
                </option>
              ))}
            </select>
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
            disabled={isSharing || !selectedCommunityId || isLoading}
          >
            {isSharing ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sharing...
              </>
            ) : (
              <>
                <FaShare className="w-4 h-4" />
                Share to {selectedCommunity?.name || "community"}
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
