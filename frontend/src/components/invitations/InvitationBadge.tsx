import { useState, useEffect } from "react";
import APIManager from "../../network/api";

interface InvitationBadgeProps {
  className?: string;
}

const InvitationBadge = ({ className = "" }: InvitationBadgeProps) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const response = await APIManager.getMyInvites();
        setCount(response.data.length);
      } catch {
        // Silently fail - badge is non-critical
      }
    }

    fetchCount();

    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className={`badge badge-sm badge-primary ${className}`}>
      {count}
    </span>
  );
};

export default InvitationBadge;
