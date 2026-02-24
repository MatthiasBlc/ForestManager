import { useCallback } from "react";
import toast from "react-hot-toast";
import { useSocketEvent } from "./useSocketEvent";
import { Notification } from "../models/notification";

interface NotificationNewEvent {
  notification: Notification;
}

export function useNotificationToasts() {
  const handler = useCallback((data: NotificationNewEvent) => {
    const notif = data.notification;
    if (notif?.message) {
      toast(notif.message, { icon: "🔔" });
    }
  }, []);

  useSocketEvent<NotificationNewEvent>("notification:new", handler);
}
