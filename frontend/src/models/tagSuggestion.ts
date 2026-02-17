export type TagSuggestionStatus = "PENDING_OWNER" | "ACCEPTED" | "REJECTED" | "PENDING_MODERATOR";

export interface TagSuggestion {
  id: string;
  tagName: string;
  status: TagSuggestionStatus;
  createdAt: string;
  decidedAt: string | null;
  recipeId: string;
  suggestedById: string;
  suggestedBy: {
    id: string;
    username: string;
  };
}

export interface TagSuggestionsResponse {
  data: TagSuggestion[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
