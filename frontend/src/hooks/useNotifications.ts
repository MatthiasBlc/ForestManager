import { useState, useEffect, useCallback } from "react";
import APIManager from "../network/api";
import { Notification, NotificationsResponse } from "../models/notification";
import { useSocketEvent } from "./useSocketEvent";

interface UseNotificationsParams {
  category?: string;
  unreadOnly?: boolean;
  limit?: number;
}

interface NotificationNewEvent {
  notification: Notification;
}

/**
 * Hook pour charger les notifications avec pagination, filtres et mise a jour temps-reel.
 */
export function useNotifications(params: UseNotificationsParams = {}) {
  const { category, unreadOnly, limit = 20 } = params;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number, reset = false) => {
    try {
      setLoading(true);
      setError(null);
      const res: NotificationsResponse = await APIManager.getNotifications({
        page: pageNum,
        limit,
        category,
        unreadOnly,
      });

      if (reset) {
        setNotifications(res.data);
      } else {
        setNotifications((prev) => [...prev, ...res.data]);
      }
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
      setPage(pageNum);
    } catch {
      setError("Erreur lors du chargement des notifications");
    } finally {
      setLoading(false);
    }
  }, [limit, category, unreadOnly]);

  // Chargement initial et reload quand les filtres changent
  useEffect(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  // Charger la page suivante
  const loadMore = useCallback(() => {
    if (page < totalPages && !loading) {
      fetchNotifications(page + 1);
    }
  }, [page, totalPages, loading, fetchNotifications]);

  // Refresh complet
  const refresh = useCallback(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  // Marquer une notification comme lue (local + API)
  const markAsRead = useCallback(async (id: string) => {
    // Si c'est un groupe, marquer toutes les notifs du groupe
    const notif = notifications.find((n) => n.id === id);
    if (notif?.group) {
      const ids = notif.group.notificationIds;
      await APIManager.markBatchAsRead(ids);
    } else {
      await APIManager.markAsRead(id);
    }

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
  }, [notifications]);

  // Marquer tout comme lu
  const markAllAsRead = useCallback(async (cat?: string) => {
    await APIManager.markAllAsRead(cat);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
  }, []);

  // Ajouter les nouvelles notifications temps-reel en tete de liste
  const handleNewNotification = useCallback((data: NotificationNewEvent) => {
    const newNotif: Notification = {
      ...data.notification,
      group: null,
    };

    // Filtrer selon les params actifs
    if (category && newNotif.category !== category) return;
    if (unreadOnly && newNotif.readAt !== null) return;

    setNotifications((prev) => [newNotif, ...prev]);
    setTotal((prev) => prev + 1);
  }, [category, unreadOnly]);

  useSocketEvent<NotificationNewEvent>("notification:new", handleNewNotification);

  return {
    notifications,
    loading,
    error,
    page,
    totalPages,
    total,
    hasMore: page < totalPages,
    loadMore,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
