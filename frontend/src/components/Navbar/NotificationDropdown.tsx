import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheck, FaTimes } from "react-icons/fa";
import { ReceivedInvite } from "../../models/community";
import APIManager from "../../network/api";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useSocketEvent } from "../../hooks/useSocketEvent";

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastSeenCountRef = useRef<number>(0);

  const fetchInvites = useCallback(async () => {
    try {
      const response = await APIManager.getMyInvites();
      const pending = response.data;
      setInvites(pending);

      const newCount = pending.length;
      if (newCount > lastSeenCountRef.current) {
        setUnreadCount(newCount - lastSeenCountRef.current);
      } else if (!isOpen) {
        lastSeenCountRef.current = newCount;
        setUnreadCount(0);
      }
    } catch {
      // Non-critical
    }
  }, [isOpen]);

  // Initial fetch on mount
  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // Re-fetch on relevant socket notification events
  const handleNotification = useCallback(
    (data: { type: string }) => {
      if (
        data.type === "INVITE_SENT" ||
        data.type === "INVITE_CANCELLED" ||
        data.type === "INVITE_ACCEPTED" ||
        data.type === "INVITE_REJECTED"
      ) {
        fetchInvites();
      }
    },
    [fetchInvites]
  );

  useSocketEvent("notification", handleNotification);

  useClickOutside(menuRef, useCallback(() => setIsOpen(false), []));

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      lastSeenCountRef.current = invites.length;
      setUnreadCount(0);
    }
  };

  const handleAccept = async (invite: ReceivedInvite) => {
    try {
      setActionLoading(invite.id);
      setActionError(null);
      const result = await APIManager.acceptInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      lastSeenCountRef.current = Math.max(0, lastSeenCountRef.current - 1);
      setIsOpen(false);
      navigate(`/communities/${result.community.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (invite: ReceivedInvite) => {
    try {
      setActionLoading(invite.id);
      setActionError(null);
      await APIManager.rejectInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      lastSeenCountRef.current = Math.max(0, lastSeenCountRef.current - 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject invitation");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="btn btn-ghost btn-circle"
        onClick={handleOpen}
        aria-label="Notifications"
      >
        <div className="indicator">
          <FaBell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="indicator-item badge badge-primary badge-xs">
              {unreadCount}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50">
          <div className="px-4 py-3 border-b border-base-300">
            <p className="font-medium">Notifications</p>
          </div>

          {actionError && (
            <div className="px-4 py-2 bg-error/10 text-error text-sm">
              {actionError}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {invites.length > 0 ? (
              <ul className="divide-y divide-base-300">
                {invites.slice(0, 5).map((invite) => (
                  <li key={invite.id} className="px-4 py-3">
                    <p className="text-sm mb-1">
                      <span className="font-medium">{invite.inviter.username}</span>
                      {" "}invited you to{" "}
                      <span className="font-medium">{invite.community.name}</span>
                    </p>
                    <p className="text-xs text-base-content/50 mb-2">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-success btn-xs gap-1"
                        onClick={() => handleAccept(invite)}
                        disabled={actionLoading === invite.id}
                      >
                        {actionLoading === invite.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <FaCheck className="w-2.5 h-2.5" />
                        )}
                        Accept
                      </button>
                      <button
                        className="btn btn-error btn-xs gap-1"
                        onClick={() => handleReject(invite)}
                        disabled={actionLoading === invite.id}
                      >
                        <FaTimes className="w-2.5 h-2.5" />
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-base-content/60">
                No pending notifications
              </div>
            )}
          </div>

          <div className="border-t border-base-300 p-2">
            <button
              className="btn btn-ghost btn-sm w-full"
              onClick={() => {
                setIsOpen(false);
                navigate("/invitations");
              }}
            >
              See all invitations
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
