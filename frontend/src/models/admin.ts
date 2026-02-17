export interface AdminUser {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
}

export interface AdminLoginResponse {
  requiresTotpSetup: boolean;
  qrCode?: string;
  message: string;
}

export interface AdminTotpResponse {
  message: string;
  admin: AdminUser;
}

// --------------- Admin Management Types ---------------

export interface AdminTag {
  id: string;
  name: string;
  recipeCount: number;
  scope?: "GLOBAL" | "COMMUNITY";
  status?: "APPROVED" | "PENDING";
  communityId?: string | null;
  community?: { name: string } | null;
}

export interface AdminIngredient {
  id: string;
  name: string;
  recipeCount: number;
}

export interface AdminFeature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  communityCount?: number;
  createdAt: string;
}

export interface AdminCommunity {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  memberCount: number;
  recipeCount: number;
  features: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface AdminCommunityMember {
  id: string;
  username: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface AdminCommunityFeature {
  id: string;
  code: string;
  name: string;
  grantedAt: string;
  grantedBy: string;
  revokedAt: string | null;
}

export interface AdminCommunityDetail {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  recipeCount: number;
  pendingInvites: number;
  members: AdminCommunityMember[];
  features: AdminCommunityFeature[];
}

export interface AdminActivityLog {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  admin: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AdminActivityResponse {
  activities: AdminActivityLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    remaining: number;
  };
}

// --------------- Dashboard Types ---------------

export interface DashboardStats {
  totals: {
    users: number;
    communities: number;
    recipes: number;
    tags: number;
    ingredients: number;
    features: number;
  };
  lastWeek: {
    newUsers: number;
    newCommunities: number;
    newRecipes: number;
  };
  topCommunities: {
    id: string;
    name: string;
    memberCount: number;
    recipeCount: number;
  }[];
}
