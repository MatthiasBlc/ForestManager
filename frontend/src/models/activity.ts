export type ActivityType =
  | "RECIPE_CREATED"
  | "RECIPE_UPDATED"
  | "RECIPE_DELETED"
  | "RECIPE_SHARED"
  | "VARIANT_PROPOSED"
  | "VARIANT_CREATED"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "USER_JOINED"
  | "USER_LEFT"
  | "USER_KICKED"
  | "USER_PROMOTED"
  | "INVITE_SENT"
  | "INVITE_ACCEPTED"
  | "INVITE_REJECTED"
  | "INVITE_CANCELLED";

export interface ActivityUser {
  id: string;
  username: string;
}

export interface ActivityRecipe {
  id: string;
  title: string;
  isDeleted: boolean;
}

export interface ActivityCommunity {
  id: string;
  name: string;
  isDeleted: boolean;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: ActivityUser;
  recipe: ActivityRecipe | null;
  community?: ActivityCommunity | null;
}

export interface ActivityResponse {
  data: ActivityItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
