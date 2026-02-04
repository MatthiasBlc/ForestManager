import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheck, FaTimes } from "react-icons/fa";
import { ReceivedInvite } from "../../models/community";
import APIManager from "../../network/api";

interface InviteCardProps {
  invite: ReceivedInvite;
  onRespond: () => void;
}

const InviteCard = ({ invite, onRespond }: InviteCardProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    try {
      setLoading("accept");
      setError(null);
      const result = await APIManager.acceptInvite(invite.id);
      navigate(`/communities/${result.community.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
      setLoading(null);
    }
  };

  const handleReject = async () => {
    try {
      setLoading("reject");
      setError(null);
      await APIManager.rejectInvite(invite.id);
      onRespond();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject invitation");
    } finally {
      setLoading(null);
    }
  };

  const isPending = invite.status === "PENDING";

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h3 className="card-title text-lg">{invite.community.name}</h3>
        {invite.community.description && (
          <p className="text-base-content/70 text-sm line-clamp-2">
            {invite.community.description}
          </p>
        )}
        <p className="text-sm text-base-content/60">
          Invited by <span className="font-medium">{invite.inviter.username}</span>
          {" "}on {new Date(invite.createdAt).toLocaleDateString()}
        </p>

        {error && (
          <div className="alert alert-error alert-sm py-1 mt-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {isPending ? (
          <div className="card-actions justify-end mt-2">
            <button
              className="btn btn-error btn-sm gap-1"
              onClick={handleReject}
              disabled={loading !== null}
            >
              {loading === "reject" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FaTimes className="w-3 h-3" />
              )}
              Reject
            </button>
            <button
              className="btn btn-success btn-sm gap-1"
              onClick={handleAccept}
              disabled={loading !== null}
            >
              {loading === "accept" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FaCheck className="w-3 h-3" />
              )}
              Accept
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <span className={`badge ${invite.status === "ACCEPTED" ? "badge-success" : "badge-error"}`}>
              {invite.status}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteCard;
