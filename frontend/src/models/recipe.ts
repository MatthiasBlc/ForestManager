export interface Tag {
  id: string;
  name: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  ingredientId: string;
  quantity: string | null;
  order: number;
}

export interface RecipeListItem {
  id: string;
  title: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface CommunityRecipeListItem extends RecipeListItem {
  creatorId: string;
  creator: { id: string; username: string };
  sharedFromCommunityId?: string | null;
  sharedFromCommunity?: { id: string; name: string } | null;
}

export interface RecipeDetail {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creator: {
    id: string;
    username: string;
  };
  tags: Tag[];
  ingredients: RecipeIngredient[];
  communityId?: string | null;
  community?: { id: string; name: string } | null;
  originRecipeId?: string | null;
  isVariant?: boolean;
  sharedFromCommunityId?: string | null;
  sharedFromCommunity?: { id: string; name: string } | null;
}

export interface RecipesResponse {
  data: RecipeListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CommunityRecipesResponse {
  data: CommunityRecipeListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface TagSearchResult {
  id: string;
  name: string;
  recipeCount: number;
}

export interface IngredientSearchResult {
  id: string;
  name: string;
  recipeCount: number;
}

// Legacy interface for backwards compatibility
export interface Recipe {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  communityId?: string | null;
}

// Proposals
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface Proposal {
  id: string;
  proposedTitle: string;
  proposedContent: string;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
  recipeId: string;
  proposerId: string;
  proposer: {
    id: string;
    username: string;
  };
  recipe?: {
    id: string;
    title: string;
    communityId: string | null;
    creatorId: string;
  };
}

export interface ProposalsResponse {
  data: Proposal[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProposalInput {
  proposedTitle: string;
  proposedContent: string;
}

// Variants
export interface VariantListItem {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creator: {
    id: string;
    username: string;
  };
  communityId: string | null;
  originRecipeId: string | null;
  isVariant: boolean;
  tags: Tag[];
}

export interface VariantsResponse {
  data: VariantListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface RejectProposalResponse {
  proposal: Proposal;
  variant: VariantListItem;
}
