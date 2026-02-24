import { useState, useEffect, useCallback } from "react";
import APIManager from "../network/api";
import { useSocketEvent } from "./useSocketEvent";
import { UnreadCountResponse } from "../models/notification";

/**
 * Hook temps-reel pour le compteur de notifications non-lues.
 * Init via REST, mise a jour via WebSocket notification:count.
 */
export function useUnreadCount() {
  const [data, setData] = useState<UnreadCountResponse>({ count: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);

  // Fetch initial
  useEffect(() => {
    let cancelled = false;
    APIManager.getUnreadCount()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Mise a jour temps-reel via WebSocket
  const handleCountUpdate = useCallback((countData: UnreadCountResponse) => {
    setData(countData);
  }, []);

  useSocketEvent<UnreadCountResponse>("notification:count", handleCountUpdate);

  // Fonction pour forcer un refresh (apres mark-as-read par exemple)
  const refresh = useCallback(async () => {
    try {
      const res = await APIManager.getUnreadCount();
      setData(res);
    } catch {
      // Non-critical
    }
  }, []);

  return { ...data, loading, refresh };
}
