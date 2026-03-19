import { AxiosError } from "axios";
import {
  RecipeDetail,
  RecipesResponse,
  CommunityRecipesResponse,
  TagSearchResult,
  IngredientSearchResult,
  Proposal,
  ProposalsResponse,
  ProposalInput,
  VariantsResponse,
  RejectProposalResponse,
  UnitsByCategory,
  SuggestedUnit,
} from "../models/recipe";
import { ActivityResponse } from "../models/activity";
import { ChangelogResponse, ChangelogEntry } from "../models/changelog";
import { User } from "../models/user";
import { CommunityTag } from "../models/tag";
import { TagSuggestion, TagSuggestionsResponse } from "../models/tagSuggestion";
import { TagPreference } from "../models/preferences";
import {
  NotificationsResponse,
  UnreadCountResponse,
  NotificationPreferencesResponse,
} from "../models/notification";
import {
  CommunityListItem,
  CommunityDetail,
  CommunityMember,
  CommunityInvite,
  ReceivedInvite,
} from "../models/community";
import { ConflictError } from "../errors/http_errors";

import { API, buildQueryString, handleApiError, handleApiErrorWith } from "./apiClient";
import * as adminApi from "./adminApi";
import * as mealApi from "./mealApi";

export interface RecipeInput {
  title: string;
  servings: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps: { instruction: string }[];
  tags?: string[];
  ingredients?: { name: string; quantity?: number; unitId?: string }[];
}

export interface GetRecipesParams {
  limit?: number;
  offset?: number;
  tags?: string[];
  ingredients?: string[];
  search?: string;
}

export interface SignUpCredentials {
  username: string;
  email: string;
  password: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export default class APIManager {
  // --------------- Recipes ---------------

  static async getRecipes(params: GetRecipesParams = {}): Promise<RecipesResponse> {
    const qs = buildQueryString({
      limit: params.limit,
      offset: params.offset,
      tags: params.tags,
      ingredients: params.ingredients,
      search: params.search,
    });
    const response = await API.get(`/api/recipes${qs}`).catch(handleApiError);
    return response.data;
  }

  static async getRecipe(recipeId: string): Promise<RecipeDetail> {
    const response = await API.get(`/api/recipes/${recipeId}`).catch(
      handleApiErrorWith({ 404: "Recipe not found", 403: "Cannot access this recipe" })
    );
    return response.data;
  }

  static async importRecipeFromUrl(
    url: string
  ): Promise<import("../services/recipeParser").ParsedRecipe> {
    const response = await API.post("/api/recipes/import-url", JSON.stringify({ url })).catch(
      handleApiError
    );
    return response.data.data;
  }

  static async createRecipe(recipe: RecipeInput): Promise<RecipeDetail> {
    const response = await API.post("/api/recipes", JSON.stringify(recipe)).catch(handleApiError);
    return response.data;
  }

  static async updateRecipe(recipeId: string, recipe: Partial<RecipeInput>): Promise<RecipeDetail> {
    const response = await API.patch("/api/recipes/" + recipeId, JSON.stringify(recipe)).catch(
      handleApiError
    );
    return response.data;
  }

  static async deleteRecipe(recipeId: string) {
    const response = await API.delete("/api/recipes/" + recipeId).catch(handleApiError);
    return response.data;
  }

  // --------------- Community Recipes ---------------

  static async getCommunityRecipes(
    communityId: string,
    params: GetRecipesParams = {}
  ): Promise<CommunityRecipesResponse> {
    const qs = buildQueryString({
      limit: params.limit,
      offset: params.offset,
      tags: params.tags,
      ingredients: params.ingredients,
      search: params.search,
    });
    const response = await API.get(`/api/communities/${communityId}/recipes${qs}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async createCommunityRecipe(
    communityId: string,
    recipe: RecipeInput
  ): Promise<RecipeDetail> {
    const response = await API.post(
      `/api/communities/${communityId}/recipes`,
      JSON.stringify(recipe)
    ).catch(handleApiError);
    return response.data.community;
  }

  // --------------- Proposals ---------------

  static async getRecipeProposals(recipeId: string, status?: string): Promise<ProposalsResponse> {
    const params = buildQueryString({ status });
    const response = await API.get(`/api/recipes/${recipeId}/proposals${params}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async createProposal(recipeId: string, proposal: ProposalInput): Promise<Proposal> {
    const response = await API.post(
      `/api/recipes/${recipeId}/proposals`,
      JSON.stringify(proposal)
    ).catch(handleApiErrorWith({ 400: "Cannot create proposal" }));
    return response.data;
  }

  static async getProposal(proposalId: string): Promise<Proposal> {
    const response = await API.get(`/api/proposals/${proposalId}`).catch(handleApiError);
    return response.data;
  }

  static async acceptProposal(proposalId: string): Promise<Proposal> {
    const response = await API.post(`/api/proposals/${proposalId}/accept`).catch(
      handleApiErrorWith({ 409: ConflictError, 400: "Cannot accept proposal" })
    );
    return response.data;
  }

  static async rejectProposal(proposalId: string): Promise<RejectProposalResponse> {
    const response = await API.post(`/api/proposals/${proposalId}/reject`).catch(
      handleApiErrorWith({ 400: "Cannot reject proposal" })
    );
    return response.data;
  }

  // --------------- Share (Fork) ---------------

  static async shareRecipe(recipeId: string, targetCommunityId: string): Promise<RecipeDetail> {
    const response = await API.post(
      `/api/recipes/${recipeId}/share`,
      JSON.stringify({ targetCommunityId })
    ).catch(handleApiErrorWith({ 403: "Cannot share this recipe", 400: "Invalid share request" }));
    return response.data;
  }

  // --------------- Publish (personal → communities) ---------------

  static async publishToCommunities(
    recipeId: string,
    communityIds: string[]
  ): Promise<{
    data: {
      id: string;
      title: string;
      communityId: string;
      community: { id: string; name: string };
    }[];
  }> {
    const response = await API.post(
      `/api/recipes/${recipeId}/publish`,
      JSON.stringify({ communityIds })
    ).catch(
      handleApiErrorWith({ 403: "Cannot publish this recipe", 400: "Invalid publish request" })
    );
    return response.data;
  }

  static async getRecipeCommunities(
    recipeId: string
  ): Promise<{ data: { id: string; name: string }[] }> {
    const response = await API.get(`/api/recipes/${recipeId}/communities`).catch(handleApiError);
    return response.data;
  }

  // --------------- Variants ---------------

  static async getRecipeVariants(
    recipeId: string,
    limit?: number,
    offset?: number
  ): Promise<VariantsResponse> {
    const qs = buildQueryString({ limit, offset });
    const response = await API.get(`/api/recipes/${recipeId}/variants${qs}`).catch(handleApiError);
    return response.data;
  }

  // --------------- Tag Suggestions ---------------

  static async getTagSuggestions(
    recipeId: string,
    status?: string
  ): Promise<TagSuggestionsResponse> {
    const params = buildQueryString({ status });
    const response = await API.get(`/api/recipes/${recipeId}/tag-suggestions${params}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async createTagSuggestion(recipeId: string, tagName: string): Promise<TagSuggestion> {
    const response = await API.post(
      `/api/recipes/${recipeId}/tag-suggestions`,
      JSON.stringify({ tagName })
    ).catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async acceptTagSuggestion(suggestionId: string): Promise<TagSuggestion> {
    const response = await API.post(`/api/tag-suggestions/${suggestionId}/accept`).catch(
      handleApiError
    );
    return response.data;
  }

  static async rejectTagSuggestion(suggestionId: string): Promise<TagSuggestion> {
    const response = await API.post(`/api/tag-suggestions/${suggestionId}/reject`).catch(
      handleApiError
    );
    return response.data;
  }

  // --------------- Tags ---------------

  static async searchTags(
    search: string = "",
    limit: number = 20,
    communityId?: string
  ): Promise<TagSearchResult[]> {
    const qs = buildQueryString({ search: search || undefined, limit, communityId });
    const response = await API.get(`/api/tags${qs}`).catch(handleApiError);
    return response.data.data;
  }

  // --------------- Ingredients ---------------

  static async searchIngredients(
    search: string = "",
    limit: number = 20
  ): Promise<IngredientSearchResult[]> {
    const qs = buildQueryString({ search: search || undefined, limit });
    const response = await API.get(`/api/ingredients${qs}`).catch(handleApiError);
    return response.data.data;
  }

  static async getUnits(): Promise<UnitsByCategory> {
    const response = await API.get("/api/units").catch(handleApiError);
    return response.data.data;
  }

  static async getSuggestedUnit(ingredientId: string): Promise<SuggestedUnit> {
    const response = await API.get(`/api/ingredients/${ingredientId}/suggested-unit`).catch(
      handleApiError
    );
    return response.data;
  }

  // --------------- Users Auth ---------------

  static async getLoggedInUser(): Promise<User> {
    const response = await API.get("/api/auth/me").catch(handleApiError);
    return response.data.user;
  }

  static async signUp(credentials: SignUpCredentials): Promise<User> {
    const response = await API.post("/api/auth/signup", JSON.stringify(credentials)).catch(
      handleApiError
    );
    return response.data.user;
  }

  static async login(credentials: LoginCredentials): Promise<User> {
    const response = await API.post("/api/auth/login", JSON.stringify(credentials)).catch(
      handleApiError
    );
    return response.data.user;
  }

  static async logout() {
    const response = await API.post("/api/auth/logout").catch(handleApiError);
    return response.data;
  }

  // --------------- Communities ---------------

  static async getCommunities(): Promise<{ data: CommunityListItem[] }> {
    const response = await API.get("/api/communities").catch(handleApiError);
    return response.data;
  }

  static async createCommunity(data: {
    name: string;
    description?: string;
  }): Promise<CommunityDetail> {
    const response = await API.post("/api/communities", JSON.stringify(data)).catch(handleApiError);
    return response.data;
  }

  static async getCommunity(id: string): Promise<CommunityDetail> {
    const response = await API.get(`/api/communities/${id}`).catch(handleApiError);
    return response.data;
  }

  static async updateCommunity(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<CommunityDetail> {
    const response = await API.patch(`/api/communities/${id}`, JSON.stringify(data)).catch(
      handleApiError
    );
    return response.data;
  }

  // --------------- Recipe Images ---------------

  static async getRecipeUploadUrl(
    recipeId: string
  ): Promise<{ uploadUrl: string; imageKey: string }> {
    const response = await API.post(`/api/recipes/${recipeId}/upload-url`).catch(handleApiError);
    return response.data;
  }

  static async confirmRecipeUpload(
    recipeId: string
  ): Promise<{ imageKey: string; imageUrl: string }> {
    const response = await API.post(`/api/recipes/${recipeId}/confirm-upload`).catch(
      handleApiError
    );
    return response.data;
  }

  static async deleteRecipeImage(recipeId: string): Promise<void> {
    await API.delete(`/api/recipes/${recipeId}/image`).catch(handleApiError);
  }

  // --------------- Community Images ---------------

  static async getCommunityUploadUrl(
    communityId: string
  ): Promise<{ uploadUrl: string; imageKey: string }> {
    const response = await API.post(`/api/communities/${communityId}/upload-url`).catch(
      handleApiError
    );
    return response.data;
  }

  static async confirmCommunityUpload(
    communityId: string
  ): Promise<{ imageKey: string; imageUrl: string }> {
    const response = await API.post(`/api/communities/${communityId}/confirm-upload`).catch(
      handleApiError
    );
    return response.data;
  }

  static async deleteCommunityImage(communityId: string): Promise<void> {
    await API.delete(`/api/communities/${communityId}/image`).catch(handleApiError);
  }

  // --------------- Members ---------------

  static async getCommunityMembers(communityId: string): Promise<{ data: CommunityMember[] }> {
    const response = await API.get(`/api/communities/${communityId}/members`).catch(handleApiError);
    return response.data;
  }

  static async promoteMember(communityId: string, userId: string): Promise<{ message: string }> {
    const response = await API.patch(
      `/api/communities/${communityId}/members/${userId}`,
      JSON.stringify({ role: "MODERATOR" })
    ).catch(handleApiError);
    return response.data;
  }

  static async removeMember(communityId: string, userId: string): Promise<{ message: string }> {
    const response = await API.delete(`/api/communities/${communityId}/members/${userId}`).catch(
      (error: AxiosError<{ message?: string; error?: string }>) => {
        if (error.response?.status === 410) {
          return error.response;
        }
        return handleApiError(error);
      }
    );
    return response.data;
  }

  // --------------- Users ---------------

  static async searchUsers(query: string): Promise<{ id: string; username: string }[]> {
    const response = await API.get(`/api/users/search?q=${encodeURIComponent(query)}`).catch(
      handleApiError
    );
    return response.data.data;
  }

  static async updateProfile(data: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<User> {
    const response = await API.patch("/api/users/me", JSON.stringify(data)).catch(handleApiError);
    return response.data.user;
  }

  // --------------- User Preferences ---------------

  static async getTagPreferences(): Promise<{ data: TagPreference[] }> {
    const response = await API.get("/api/users/me/tag-preferences").catch(handleApiError);
    return response.data;
  }

  static async updateTagPreference(
    communityId: string,
    showTags: boolean
  ): Promise<{ communityId: string; showTags: boolean }> {
    const response = await API.put(
      `/api/users/me/tag-preferences/${communityId}`,
      JSON.stringify({ showTags })
    ).catch(handleApiError);
    return response.data;
  }

  // --------------- Notifications ---------------

  static async getNotifications(
    params: {
      page?: number;
      limit?: number;
      category?: string;
      unreadOnly?: boolean;
      grouped?: boolean;
    } = {}
  ): Promise<NotificationsResponse> {
    const qs = buildQueryString({
      page: params.page,
      limit: params.limit,
      category: params.category,
      unreadOnly: params.unreadOnly ? "true" : undefined,
      grouped: params.grouped === false ? "false" : undefined,
    });
    const response = await API.get(`/api/notifications${qs}`).catch(handleApiError);
    return response.data;
  }

  static async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await API.get("/api/notifications/unread-count").catch(handleApiError);
    return response.data;
  }

  static async markAsRead(id: string): Promise<{ id: string; readAt: string }> {
    const response = await API.patch(`/api/notifications/${id}/read`).catch(handleApiError);
    return response.data;
  }

  static async markBatchAsRead(ids: string[]): Promise<{ updated: number }> {
    const response = await API.patch("/api/notifications/read", JSON.stringify({ ids })).catch(
      handleApiError
    );
    return response.data;
  }

  static async markAllAsRead(category?: string): Promise<{ updated: number }> {
    const response = await API.patch(
      "/api/notifications/read-all",
      JSON.stringify({ category })
    ).catch(handleApiError);
    return response.data;
  }

  static async getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
    const response = await API.get("/api/notifications/preferences").catch(handleApiError);
    return response.data;
  }

  static async updateNotificationPreference(
    category: string,
    enabled: boolean,
    communityId?: string
  ): Promise<{ category: string; enabled: boolean; communityId: string | null }> {
    const response = await API.put(
      "/api/notifications/preferences",
      JSON.stringify({ category, enabled, communityId })
    ).catch(handleApiError);
    return response.data;
  }

  // --------------- Invitations (community admin) ---------------

  static async getCommunityInvites(
    communityId: string,
    status?: string
  ): Promise<{ data: CommunityInvite[] }> {
    const params = buildQueryString({ status });
    const response = await API.get(`/api/communities/${communityId}/invites${params}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async sendInvite(
    communityId: string,
    data: { username?: string; email?: string; userId?: string }
  ): Promise<CommunityInvite> {
    const response = await API.post(
      `/api/communities/${communityId}/invites`,
      JSON.stringify(data)
    ).catch(handleApiError);
    return response.data;
  }

  static async cancelInvite(communityId: string, inviteId: string): Promise<{ message: string }> {
    const response = await API.delete(`/api/communities/${communityId}/invites/${inviteId}`).catch(
      handleApiError
    );
    return response.data;
  }

  // --------------- Invitations (user) ---------------

  static async getMyInvites(status?: string): Promise<{ data: ReceivedInvite[] }> {
    const params = buildQueryString({ status });
    const response = await API.get(`/api/users/me/invites${params}`).catch(handleApiError);
    return response.data;
  }

  static async acceptInvite(
    inviteId: string
  ): Promise<{ message: string; community: { id: string; name: string } }> {
    const response = await API.post(`/api/invites/${inviteId}/accept`).catch(handleApiError);
    return response.data;
  }

  static async rejectInvite(inviteId: string): Promise<{ message: string }> {
    const response = await API.post(`/api/invites/${inviteId}/reject`).catch(handleApiError);
    return response.data;
  }

  // --------------- Changelog ---------------

  static async getChangelog(
    params: { limit?: number; offset?: number } = {}
  ): Promise<ChangelogResponse> {
    const qs = buildQueryString({ limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/changelog${qs}`).catch(handleApiError);
    return response.data;
  }

  static async getChangelogEntry(id: string): Promise<ChangelogEntry> {
    const response = await API.get(`/api/changelog/${id}`).catch(handleApiError);
    return response.data;
  }

  // --------------- Activity Feed ---------------

  static async getCommunityActivity(
    communityId: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<ActivityResponse> {
    const qs = buildQueryString({ limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/communities/${communityId}/activity${qs}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async getMyActivity(
    params: { limit?: number; offset?: number } = {}
  ): Promise<ActivityResponse> {
    const qs = buildQueryString({ limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/users/me/activity${qs}`).catch(handleApiError);
    return response.data;
  }

  // --------------- Community Tags (moderator) ---------------

  static async getCommunityTags(
    communityId: string,
    params?: { status?: string; search?: string }
  ): Promise<{ data: CommunityTag[]; total: number }> {
    const qs = buildQueryString({ status: params?.status, search: params?.search });
    const response = await API.get(`/api/communities/${communityId}/tags${qs}`).catch(
      handleApiError
    );
    return response.data;
  }

  static async createCommunityTag(communityId: string, name: string): Promise<CommunityTag> {
    const response = await API.post(
      `/api/communities/${communityId}/tags`,
      JSON.stringify({ name })
    ).catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async updateCommunityTag(
    communityId: string,
    tagId: string,
    name: string
  ): Promise<CommunityTag> {
    const response = await API.patch(
      `/api/communities/${communityId}/tags/${tagId}`,
      JSON.stringify({ name })
    ).catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async deleteCommunityTag(communityId: string, tagId: string): Promise<void> {
    await API.delete(`/api/communities/${communityId}/tags/${tagId}`).catch(handleApiError);
  }

  static async approveCommunityTag(communityId: string, tagId: string): Promise<CommunityTag> {
    const response = await API.post(`/api/communities/${communityId}/tags/${tagId}/approve`).catch(
      handleApiError
    );
    return response.data;
  }

  static async rejectCommunityTag(communityId: string, tagId: string): Promise<void> {
    await API.post(`/api/communities/${communityId}/tags/${tagId}/reject`).catch(handleApiError);
  }

  // --------------- Admin (delegated to adminApi) ---------------

  static adminLogin = adminApi.adminLogin;
  static adminVerifyTotp = adminApi.adminVerifyTotp;
  static adminLogout = adminApi.adminLogout;
  static getLoggedInAdmin = adminApi.getLoggedInAdmin;
  static getAdminDashboardStats = adminApi.getAdminDashboardStats;
  static getAdminTags = adminApi.getAdminTags;
  static createAdminTag = adminApi.createAdminTag;
  static updateAdminTag = adminApi.updateAdminTag;
  static deleteAdminTag = adminApi.deleteAdminTag;
  static mergeAdminTags = adminApi.mergeAdminTags;
  static getAdminTagRecipes = adminApi.getAdminTagRecipes;
  static getAdminRecipe = adminApi.getAdminRecipe;
  static updateAdminRecipe = adminApi.updateAdminRecipe;
  static deleteAdminRecipe = adminApi.deleteAdminRecipe;
  static getAdminIngredients = adminApi.getAdminIngredients;
  static createAdminIngredient = adminApi.createAdminIngredient;
  static updateAdminIngredient = adminApi.updateAdminIngredient;
  static deleteAdminIngredient = adminApi.deleteAdminIngredient;
  static mergeAdminIngredients = adminApi.mergeAdminIngredients;
  static approveAdminIngredient = adminApi.approveAdminIngredient;
  static rejectAdminIngredient = adminApi.rejectAdminIngredient;
  static getAdminUnits = adminApi.getAdminUnits;
  static createAdminUnit = adminApi.createAdminUnit;
  static updateAdminUnit = adminApi.updateAdminUnit;
  static deleteAdminUnit = adminApi.deleteAdminUnit;
  static getAdminFeatures = adminApi.getAdminFeatures;
  static createAdminFeature = adminApi.createAdminFeature;
  static updateAdminFeature = adminApi.updateAdminFeature;
  static getAdminCommunities = adminApi.getAdminCommunities;
  static getAdminCommunity = adminApi.getAdminCommunity;
  static updateAdminCommunity = adminApi.updateAdminCommunity;
  static deleteAdminCommunity = adminApi.deleteAdminCommunity;
  static grantFeature = adminApi.grantFeature;
  static revokeFeature = adminApi.revokeFeature;
  static getAdminActivity = adminApi.getAdminActivity;
  static getAdminChangelog = adminApi.getAdminChangelog;
  static createAdminChangelog = adminApi.createAdminChangelog;
  static updateAdminChangelog = adminApi.updateAdminChangelog;
  static deleteAdminChangelog = adminApi.deleteAdminChangelog;

  // --------------- Meal Plan (delegated to mealApi) ---------------

  static getMealPlan = mealApi.getMealPlan;
  static createMealPlan = mealApi.createMealPlan;
  static updateMealPlan = mealApi.updateMealPlan;
  static deleteMealPlan = mealApi.deleteMealPlan;
  static updateMealSlot = mealApi.updateMealSlot;
  static swapMealSlots = mealApi.swapMealSlots;
  static getMealPlanArchives = mealApi.getMealPlanArchives;
  static getMealPlanArchive = mealApi.getMealPlanArchive;
  static deleteMealPlanArchive = mealApi.deleteMealPlanArchive;
  static getMealIdeas = mealApi.getMealIdeas;
  static createMealIdea = mealApi.createMealIdea;
  static updateMealIdea = mealApi.updateMealIdea;
  static deleteMealIdea = mealApi.deleteMealIdea;
  static listMealGenerationParams = mealApi.listMealGenerationParams;
  static getMealGenerationParams = mealApi.getMealGenerationParams;
  static createMealGenerationParams = mealApi.createMealGenerationParams;
  static updateMealGenerationParams = mealApi.updateMealGenerationParams;
  static deleteMealGenerationParams = mealApi.deleteMealGenerationParams;
  static setMealExclusions = mealApi.setMealExclusions;
  static setMealPins = mealApi.setMealPins;
  static createMealGenerationRule = mealApi.createMealGenerationRule;
  static updateMealGenerationRule = mealApi.updateMealGenerationRule;
  static deleteMealGenerationRule = mealApi.deleteMealGenerationRule;
  static generateMealPlan = mealApi.generateMealPlan;
  static replaceMealSlot = mealApi.replaceMealSlot;
}
