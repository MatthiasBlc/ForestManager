import { useState, useEffect, useCallback } from "react";
import APIManager from "../../network/api";
import { useSocketEvent } from "../../hooks/useSocketEvent";

interface InvitationBadgeProps {
  className?: string;
}

const InvitationBadge = ({ className = "" }: InvitationBadgeProps) => {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const response = await APIManager.getMyInvites();
      setCount(response.data.length);
    } catch {
      // Silently fail - badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Re-fetch on relevant socket notification events
  const handleNotification = useCallback(
    (data: { type: string }) => {
      if (
        data.type === "INVITE_SENT" ||
        data.type === "INVITE_CANCELLED"
      ) {
        fetchCount();
      }
    },
    [fetchCount]
  );

  useSocketEvent("notification", handleNotification);

  if (count === 0) return null;

  return (
    <span className={`badge badge-sm badge-primary ${className}`}>
      {count}
    </span>
  );
};

export default InvitationBadge;
