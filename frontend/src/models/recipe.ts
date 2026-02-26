export interface Tag {
  id: string;
  name: string;
  scope?: "GLOBAL" | "COMMUNITY";
  status?: "APPROVED" | "PENDING";
  communityId?: string | null;
}

export type UnitCategory = "WEIGHT" | "VOLUME" | "SPOON" | "COUNT" | "QUALITATIVE";
export type IngredientStatus = "APPROVED" | "PENDING";

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  category: UnitCategory;
  sortOrder: number;
}

export type UnitsByCategory = Partial<Record<UnitCategory, Unit[]>>;

export interface SuggestedUnit {
  suggestedUnitId: string | null;
  source: "default" | "popular" | null;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  ingredientId: string;
  quantity: number | null;
  unitId?: string | null;
  unit?: { id: string; name: string; abbreviation: string } | null;
  order: number;
}

export interface ProposalIngredient {
  id: string;
  ingredientId: string;
  ingredient: { id: string; name: string; status: IngredientStatus };
  quantity: number | null;
  unitId: string | null;
  order: number;
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

export interface RecipeListItem {
  id: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
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
  imageUrl: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
  steps: RecipeStep[];
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
  scope?: "GLOBAL" | "COMMUNITY";
  communityId?: string | null;
}

export interface IngredientSearchResult {
  id: string;
  name: string;
  recipeCount: number;
  status?: IngredientStatus;
}

// Proposals
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface ProposalStep {
  id: string;
  order: number;
  instruction: string;
}

export interface Proposal {
  id: string;
  proposedTitle: string;
  proposedServings: number | null;
  proposedPrepTime: number | null;
  proposedCookTime: number | null;
  proposedRestTime: number | null;
  proposedSteps: ProposalStep[];
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
  recipeId: string;
  proposerId: string;
  proposer: {
    id: string;
    username: string;
  };
  proposedIngredients?: ProposalIngredient[];
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

export interface ProposalIngredientInput {
  name: string;
  quantity?: number;
  unitId?: string;
}

export interface ProposalInput {
  proposedTitle: string;
  proposedServings?: number;
  proposedPrepTime?: number | null;
  proposedCookTime?: number | null;
  proposedRestTime?: number | null;
  proposedSteps?: { instruction: string }[];
  proposedIngredients?: ProposalIngredientInput[];
}

// Variants
export interface VariantListItem {
  id: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
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
