import { useState } from "react";
import toast from "react-hot-toast";
import { FaArrowUp, FaSignOutAlt, FaUserMinus } from "react-icons/fa";
import { CommunityMember } from "../../models/community";
import { useAuth } from "../../contexts/AuthContext";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";

interface MembersListProps {
  communityId: string;
  members: CommunityMember[];
  currentUserRole: "MEMBER" | "MODERATOR";
  onMembersChange: () => void;
  onLeave: () => void;
}

const MembersList = ({ communityId, members, currentUserRole, onMembersChange, onLeave }: MembersListProps) => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isModerator = currentUserRole === "MODERATOR";

  const handlePromote = async (memberId: string) => {
    if (!await confirm({ message: "Promote this member to moderator?" })) return;

    try {
      setActionLoading(memberId);
      setError(null);
      await APIManager.promoteMember(communityId, memberId);
      toast.success("Member promoted");
      onMembersChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async (memberId: string) => {
    if (!await confirm({ message: "Remove this member from the community?", confirmLabel: "Remove", confirmClass: "btn btn-error" })) return;

    try {
      setActionLoading(memberId);
      setError(null);
      await APIManager.removeMember(communityId, memberId);
      toast.success("Member removed");
      onMembersChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async () => {
    if (!user) return;

    const isLastMember = members.length === 1;
    const message = isLastMember
      ? "You are the last member of this community. Leaving will permanently destroy it and all its data. Are you sure?"
      : "Are you sure you want to leave this community?";

    if (!await confirm({ message, confirmLabel: "Leave", confirmClass: "btn btn-warning" })) return;

    try {
      setActionLoading(user.id);
      setError(null);
      await APIManager.removeMember(communityId, user.id);
      toast.success("Left community");
      onLeave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave community");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Joined</th>
              {isModerator && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isCurrentUser = member.id === user?.id;
              const isLoading = actionLoading === member.id;

              return (
                <tr key={member.id}>
                  <td>
                    {member.username}
                    {isCurrentUser && <span className="text-base-content/50 ml-1">(you)</span>}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${member.role === "MODERATOR" ? "badge-primary" : "badge-ghost"}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="text-base-content/60">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {isModerator && (
                    <td>
                      <div className="flex gap-1">
                        {isCurrentUser ? (
                          <button
                            className="btn btn-ghost btn-xs text-warning"
                            onClick={handleLeave}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <>
                                <FaSignOutAlt className="w-3 h-3" />
                                Leave
                              </>
                            )}
                          </button>
                        ) : member.role === "MEMBER" ? (
                          <>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => handlePromote(member.id)}
                              disabled={isLoading}
                              title="Promote to moderator"
                            >
                              {isLoading ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <>
                                  <FaArrowUp className="w-3 h-3" />
                                  Promote
                                </>
                              )}
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => handleKick(member.id)}
                              disabled={isLoading}
                              title="Remove from community"
                            >
                              <FaUserMinus className="w-3 h-3" />
                              Kick
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isModerator && (
        <div className="mt-4">
          <button
            className="btn btn-outline btn-warning btn-sm gap-2"
            onClick={handleLeave}
            disabled={actionLoading === user?.id}
          >
            {actionLoading === user?.id ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FaSignOutAlt className="w-3 h-3" />
            )}
            Leave community
          </button>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
};

export default MembersList;
