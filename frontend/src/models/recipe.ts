export interface Recipe {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  communityId?: string | null;
}
