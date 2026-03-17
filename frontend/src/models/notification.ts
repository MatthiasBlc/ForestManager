export type NotificationCategory =
  | "INVITATION"
  | "RECIPE_PROPOSAL"
  | "TAG"
  | "INGREDIENT"
  | "MODERATION";

export interface Notification {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl: string | null;
  actor: { id: string; username: string } | null;
  community: { id: string; name: string } | null;
  readAt: string | null;
  createdAt: string;
  group: {
    count: number;
    notificationIds: string[];
    items: {
      id: string;
      message: string;
      createdAt: string;
      readAt: string | null;
    }[];
  } | null;
}

export interface NotificationsResponse {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
  byCategory: Record<string, number>;
}

export interface NotificationPreferencesResponse {
  global: Record<string, boolean>;
  communities: {
    communityId: string;
    communityName: string;
    preferences: Record<string, boolean>;
  }[];
}
