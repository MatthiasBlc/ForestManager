import { useState, useEffect } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import { CommunityInvite } from "../../models/community";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import InviteUserModal from "./InviteUserModal";

interface SentInvitesListProps {
  communityId: string;
}

const SentInvitesList = ({ communityId }: SentInvitesListProps) => {
  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadInvites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await APIManager.getCommunityInvites(communityId, statusFilter || undefined);
      setInvites(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, statusFilter]);

  const handleCancel = async (inviteId: string) => {
    if (!await confirm({ message: "Cancel this invitation?", confirmLabel: "Cancel invitation", confirmClass: "btn btn-error" })) return;

    try {
      setCancellingId(inviteId);
      await APIManager.cancelInvite(communityId, inviteId);
      loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invitation");
    } finally {
      setCancellingId(null);
    }
  };

  const handleInviteSent = () => {
    setShowInviteModal(false);
    loadInvites();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Pending</option>
            <option value="all">All</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button
          className="btn btn-primary btn-sm gap-2"
          onClick={() => setShowInviteModal(true)}
        >
          <FaPlus className="w-3 h-3" />
          Invite user
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : invites.length === 0 ? (
        <p className="text-center py-8 text-base-content/60">No invitations found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Invited by</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.invitee.username}</td>
                  <td className="text-base-content/60">{invite.invitee.email}</td>
                  <td>
                    <span className={`badge badge-sm ${
                      invite.status === "PENDING" ? "badge-warning" :
                      invite.status === "ACCEPTED" ? "badge-success" :
                      invite.status === "REJECTED" ? "badge-error" :
                      "badge-ghost"
                    }`}>
                      {invite.status}
                    </span>
                  </td>
                  <td className="text-base-content/60">{invite.inviter.username}</td>
                  <td className="text-base-content/60">
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {invite.status === "PENDING" && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleCancel(invite.id)}
                        disabled={cancellingId === invite.id}
                      >
                        {cancellingId === invite.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <>
                            <FaTimes className="w-3 h-3" />
                            Cancel
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInviteModal && (
        <InviteUserModal
          communityId={communityId}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}

      {ConfirmDialog}
    </div>
  );
};

export default SentInvitesList;
