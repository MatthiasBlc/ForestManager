import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaTimes, FaUser, FaClock } from "react-icons/fa";
import APIManager from "../../network/api";
import { Proposal } from "../../models/recipe";
import { ConflictError } from "../../errors/http_errors";
import { formatDate } from "../../utils/format.Date";

interface ProposalsListProps {
  recipeId: string;
  refreshSignal?: number;
  onProposalDecided: () => void;
}

const ProposalsList = ({ recipeId, refreshSignal, onProposalDecided }: ProposalsListProps) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await APIManager.getRecipeProposals(recipeId, "PENDING");
      setProposals(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setIsLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals, refreshSignal]);

  const handleAccept = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      setError(null);
      await APIManager.acceptProposal(proposalId);
      toast.success("Proposal accepted");
      onProposalDecided();
      loadProposals();
    } catch (err) {
      if (err instanceof ConflictError) {
        setError("The recipe has been modified since this proposal was created. Please refresh and review the changes.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to accept proposal");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      setError(null);
      await APIManager.rejectProposal(proposalId);
      toast.success("Proposal rejected - variant created");
      onProposalDecided();
      loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject proposal");
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

  if (proposals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <FaClock className="text-warning" />
        Pending Proposals ({proposals.length})
      </h3>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {proposals.map((proposal) => (
          <div
            key={proposal.id}
            className="card bg-base-200 shadow-sm"
          >
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-base-content/70 mb-1">
                    <FaUser className="w-3 h-3" />
                    <span>{proposal.proposer.username}</span>
                    <span>-</span>
                    <span>{formatDate(proposal.createdAt)}</span>
                  </div>
                  <h4 className="font-medium truncate">{proposal.proposedTitle}</h4>
                  <button
                    className="text-sm text-primary hover:underline mt-1"
                    onClick={() => setExpandedId(expandedId === proposal.id ? null : proposal.id)}
                  >
                    {expandedId === proposal.id ? "Hide changes" : "Show changes"}
                  </button>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn btn-success btn-sm gap-1"
                    onClick={() => handleAccept(proposal.id)}
                    disabled={processingId !== null}
                    title="Accept - Update recipe with these changes"
                  >
                    {processingId === proposal.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FaCheck className="w-3 h-3" />
                    )}
                    Accept
                  </button>
                  <button
                    className="btn btn-error btn-sm gap-1"
                    onClick={() => handleReject(proposal.id)}
                    disabled={processingId !== null}
                    title="Reject - Create a variant for the proposer"
                  >
                    {processingId === proposal.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FaTimes className="w-3 h-3" />
                    )}
                    Reject
                  </button>
                </div>
              </div>

              {expandedId === proposal.id && (
                <div className="mt-4 p-3 bg-base-100 rounded-lg">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Proposed title:</span>
                      <p className="mt-1">{proposal.proposedTitle}</p>
                    </div>
                    <div>
                      <span className="font-medium">Proposed content:</span>
                      <pre className="mt-1 whitespace-pre-wrap text-xs bg-base-200 p-2 rounded max-h-48 overflow-y-auto">
                        {proposal.proposedContent}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalsList;
