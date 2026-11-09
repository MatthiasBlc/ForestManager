// Requetes du centre de notifications (C6.1).
import {
  notificationPreferencesSchema,
  notificationSchema,
  pageSchema,
  unreadCountSchema,
} from "@fm/shared";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const unreadCountQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: async () => (await api.get("/me/notifications/unread-count", unreadCountSchema)).count,
});

export const notificationsQuery = infiniteQueryOptions({
  queryKey: ["notifications", "list"],
  queryFn: ({ pageParam }) =>
    api.get(
      `/me/notifications?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      pageSchema(notificationSchema)
    ),
  initialPageParam: "",
  getNextPageParam: (page) => page.nextCursor ?? undefined,
});

export const preferencesQuery = queryOptions({
  queryKey: ["notifications", "preferences"],
  queryFn: () => api.get("/me/notification-preferences", notificationPreferencesSchema),
});
