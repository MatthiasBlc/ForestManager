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
