import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaTimes, FaUser, FaTag } from "react-icons/fa";
import APIManager from "../../network/api";
import { TagSuggestion } from "../../models/tagSuggestion";
import { formatDate } from "../../utils/format.Date";

interface TagSuggestionsListProps {
  recipeId: string;
  refreshSignal?: number;
  onSuggestionDecided: () => void;
}

const TagSuggestionsList = ({ recipeId, refreshSignal, onSuggestionDecided }: TagSuggestionsListProps) => {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await APIManager.getTagSuggestions(recipeId, "PENDING_OWNER");
      setSuggestions(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tag suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions, refreshSignal]);

  const handleAccept = async (suggestionId: string) => {
    try {
      setProcessingId(suggestionId);
      setError(null);
      await APIManager.acceptTagSuggestion(suggestionId);
      toast.success("Tag suggestion accepted");
      onSuggestionDecided();
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept suggestion");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    try {
      setProcessingId(suggestionId);
      setError(null);
      await APIManager.rejectTagSuggestion(suggestionId);
      toast.success("Tag suggestion rejected");
      onSuggestionDecided();
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject suggestion");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <FaTag className="text-info" />
        Tag Suggestions ({suggestions.length})
      </h3>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="card bg-base-200 shadow-sm"
          >
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-base-content/70 mb-1">
                    <FaUser className="w-3 h-3" />
                    <span>{suggestion.suggestedBy.username}</span>
                    <span>-</span>
                    <span>{formatDate(suggestion.createdAt)}</span>
                  </div>
                  <h4 className="font-medium">
                    <span className="badge badge-outline badge-sm mr-2">{suggestion.tagName}</span>
                  </h4>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn btn-success btn-sm gap-1"
                    onClick={() => handleAccept(suggestion.id)}
                    disabled={processingId !== null}
                    title="Accept tag suggestion"
                  >
                    {processingId === suggestion.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FaCheck className="w-3 h-3" />
                    )}
                    Accept
                  </button>
                  <button
                    className="btn btn-error btn-sm gap-1"
                    onClick={() => handleReject(suggestion.id)}
                    disabled={processingId !== null}
                    title="Reject tag suggestion"
                  >
                    {processingId === suggestion.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FaTimes className="w-3 h-3" />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagSuggestionsList;
