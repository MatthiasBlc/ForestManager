export interface Recipe {
  id: string,
  label: string,
}

export interface CommunityTag {
  id: string;
  name: string;
  scope: "GLOBAL" | "COMMUNITY";
  status: "APPROVED" | "PENDING";
  communityId: string | null;
  createdBy: { id: string; username: string } | null;
  recipeCount: number;
  createdAt: string;
}
