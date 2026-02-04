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
