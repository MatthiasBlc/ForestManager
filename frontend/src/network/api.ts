import axios, { AxiosError } from "axios";
import { RecipeDetail, RecipesResponse, CommunityRecipesResponse, TagSearchResult, IngredientSearchResult, Proposal, ProposalsResponse, ProposalInput, VariantsResponse, RejectProposalResponse, UnitsByCategory, SuggestedUnit } from "../models/recipe";
import { ActivityResponse } from "../models/activity";
import { User } from "../models/user";
import { AdminLoginResponse, AdminTotpResponse, AdminUser, DashboardStats, AdminTag, AdminIngredient, AdminUnit, AdminFeature, AdminCommunity, AdminCommunityDetail, AdminActivityResponse } from "../models/admin";
import { CommunityTag } from "../models/tag";
import { TagSuggestion, TagSuggestionsResponse } from "../models/tagSuggestion";
import { TagPreference, NotificationPreferences } from "../models/preferences";
import { NotificationsResponse, UnreadCountResponse, NotificationPreferencesResponse } from "../models/notification";
import { CommunityListItem, CommunityDetail, CommunityMember, CommunityInvite, ReceivedInvite } from "../models/community";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
const API = axios.create({ withCredentials: true, baseURL: apiUrl });

function buildQueryString(params: Record<string, string | number | string[] | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length > 0) searchParams.set(key, val.join(","));
    } else {
      searchParams.set(key, val.toString());
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

API.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/json";
  return config;
});

// Utility function to handle API errors safely
function handleApiError(error: AxiosError<{ error?: string }>): never {
  if (!error.response) {
    throw new Error("Network error - please check your connection");
  }
  if (error.response.status === 401) {
    throw new UnauthorizedError(error.response.data?.error || "Unauthorized");
  }
  if (error.response.status === 409) {
    throw new ConflictError(error.response.data?.error || "Conflict");
  }
  throw new Error(
    error.response.data?.error || `Request failed (${error.response.status})`
  );
}

// Custom error handler with status-specific fallback messages
function handleApiErrorWith(
  overrides: Record<number, string | typeof ConflictError | typeof UnauthorizedError>,
): (error: AxiosError<{ error?: string }>) => never {
  return (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status;
    const msg = error.response?.data?.error;

    if (status && overrides[status]) {
      const override = overrides[status];
      if (override === ConflictError) throw new ConflictError(msg || "Conflict");
      if (override === UnauthorizedError) throw new UnauthorizedError(msg || "Unauthorized");
      throw new Error(msg || (override as string));
    }

    return handleApiError(error);
  };
}


export interface RecipeInput {
  title: string;
  content: string;
  imageUrl?: string;
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
  username: string,
  email: string,
  password: string,
}

export interface LoginCredentials {
  username: string,
  password: string,
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
    const response = await API.get(`/api/recipes/${recipeId}`)
      .catch(handleApiErrorWith({ 404: "Recipe not found", 403: "Cannot access this recipe" }));
    return response.data;
  }

  static async createRecipe(recipe: RecipeInput): Promise<RecipeDetail> {
    const response = await API.post("/api/recipes", JSON.stringify(recipe)).catch(handleApiError);
    return response.data;
  }

  static async updateRecipe(recipeId: string, recipe: Partial<RecipeInput>): Promise<RecipeDetail> {
    const response = await API.patch("/api/recipes/" + recipeId, JSON.stringify(recipe)).catch(handleApiError);
    return response.data;
  }

  static async deleteRecipe(recipeId: string) {
    const response = await API.delete("/api/recipes/" + recipeId).catch(handleApiError);
    return response.data;
  }


  // --------------- Community Recipes ---------------

  static async getCommunityRecipes(communityId: string, params: GetRecipesParams = {}): Promise<CommunityRecipesResponse> {
    const qs = buildQueryString({
      limit: params.limit,
      offset: params.offset,
      tags: params.tags,
      ingredients: params.ingredients,
      search: params.search,
    });
    const response = await API.get(`/api/communities/${communityId}/recipes${qs}`).catch(handleApiError);
    return response.data;
  }

  static async createCommunityRecipe(communityId: string, recipe: RecipeInput): Promise<RecipeDetail> {
    const response = await API.post(`/api/communities/${communityId}/recipes`, JSON.stringify(recipe)).catch(handleApiError);
    return response.data.community;
  }


  // --------------- Proposals ---------------

  static async getRecipeProposals(recipeId: string, status?: string): Promise<ProposalsResponse> {
    const params = status ? `?status=${status}` : "";
    const response = await API.get(`/api/recipes/${recipeId}/proposals${params}`).catch(handleApiError);
    return response.data;
  }

  static async createProposal(recipeId: string, proposal: ProposalInput): Promise<Proposal> {
    const response = await API.post(`/api/recipes/${recipeId}/proposals`, JSON.stringify(proposal))
      .catch(handleApiErrorWith({ 400: "Cannot create proposal" }));
    return response.data;
  }

  static async getProposal(proposalId: string): Promise<Proposal> {
    const response = await API.get(`/api/proposals/${proposalId}`).catch(handleApiError);
    return response.data;
  }

  static async acceptProposal(proposalId: string): Promise<Proposal> {
    const response = await API.post(`/api/proposals/${proposalId}/accept`)
      .catch(handleApiErrorWith({ 409: ConflictError, 400: "Cannot accept proposal" }));
    return response.data;
  }

  static async rejectProposal(proposalId: string): Promise<RejectProposalResponse> {
    const response = await API.post(`/api/proposals/${proposalId}/reject`)
      .catch(handleApiErrorWith({ 400: "Cannot reject proposal" }));
    return response.data;
  }


  // --------------- Share (Fork) ---------------

  static async shareRecipe(recipeId: string, targetCommunityId: string): Promise<RecipeDetail> {
    const response = await API.post(`/api/recipes/${recipeId}/share`, JSON.stringify({ targetCommunityId }))
      .catch(handleApiErrorWith({ 403: "Cannot share this recipe", 400: "Invalid share request" }));
    return response.data;
  }


  // --------------- Publish (personal → communities) ---------------

  static async publishToCommunities(recipeId: string, communityIds: string[]): Promise<{ data: { id: string; title: string; communityId: string; community: { id: string; name: string } }[] }> {
    const response = await API.post(`/api/recipes/${recipeId}/publish`, JSON.stringify({ communityIds }))
      .catch(handleApiErrorWith({ 403: "Cannot publish this recipe", 400: "Invalid publish request" }));
    return response.data;
  }

  static async getRecipeCommunities(recipeId: string): Promise<{ data: { id: string; name: string }[] }> {
    const response = await API.get(`/api/recipes/${recipeId}/communities`).catch(handleApiError);
    return response.data;
  }


  // --------------- Variants ---------------

  static async getRecipeVariants(recipeId: string, limit?: number, offset?: number): Promise<VariantsResponse> {
    const qs = buildQueryString({ limit, offset });
    const response = await API.get(`/api/recipes/${recipeId}/variants${qs}`).catch(handleApiError);
    return response.data;
  }


  // --------------- Tag Suggestions ---------------

  static async getTagSuggestions(recipeId: string, status?: string): Promise<TagSuggestionsResponse> {
    const params = status ? `?status=${status}` : "";
    const response = await API.get(`/api/recipes/${recipeId}/tag-suggestions${params}`).catch(handleApiError);
    return response.data;
  }

  static async createTagSuggestion(recipeId: string, tagName: string): Promise<TagSuggestion> {
    const response = await API.post(`/api/recipes/${recipeId}/tag-suggestions`, JSON.stringify({ tagName }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async acceptTagSuggestion(suggestionId: string): Promise<TagSuggestion> {
    const response = await API.post(`/api/tag-suggestions/${suggestionId}/accept`).catch(handleApiError);
    return response.data;
  }

  static async rejectTagSuggestion(suggestionId: string): Promise<TagSuggestion> {
    const response = await API.post(`/api/tag-suggestions/${suggestionId}/reject`).catch(handleApiError);
    return response.data;
  }


  // --------------- Tags ---------------

  static async searchTags(search: string = "", limit: number = 20, communityId?: string): Promise<TagSearchResult[]> {
    const qs = buildQueryString({ search: search || undefined, limit, communityId });
    const response = await API.get(`/api/tags${qs}`).catch(handleApiError);
    return response.data.data;
  }


  // --------------- Ingredients ---------------

  static async searchIngredients(search: string = "", limit: number = 20): Promise<IngredientSearchResult[]> {
    const qs = buildQueryString({ search: search || undefined, limit });
    const response = await API.get(`/api/ingredients${qs}`).catch(handleApiError);
    return response.data.data;
  }

  static async getUnits(): Promise<UnitsByCategory> {
    const response = await API.get("/api/units").catch(handleApiError);
    return response.data;
  }

  static async getSuggestedUnit(ingredientId: string): Promise<SuggestedUnit> {
    const response = await API.get(`/api/ingredients/${ingredientId}/suggested-unit`).catch(handleApiError);
    return response.data;
  }


  // --------------- Users Auth ---------------
  // Need credentials in the header if front and back are on differents domain / sub-domains
  static async getLoggedInUser(): Promise<User> {
    const response = await API.get("/api/auth/me").catch(handleApiError);
    return response.data.user;
  }

  static async signUp(credentials: SignUpCredentials): Promise<User> {
    const response = await API.post("/api/auth/signup", JSON.stringify(credentials)).catch(handleApiError);
    return response.data.user;
  }

  static async login(credentials: LoginCredentials): Promise<User> {
    const response = await API.post("/api/auth/login", JSON.stringify(credentials)).catch(handleApiError);
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

  static async createCommunity(data: { name: string; description?: string }): Promise<CommunityDetail> {
    const response = await API.post("/api/communities", JSON.stringify(data)).catch(handleApiError);
    return response.data;
  }

  static async getCommunity(id: string): Promise<CommunityDetail> {
    const response = await API.get(`/api/communities/${id}`).catch(handleApiError);
    return response.data;
  }

  static async updateCommunity(id: string, data: { name?: string; description?: string }): Promise<CommunityDetail> {
    const response = await API.patch(`/api/communities/${id}`, JSON.stringify(data)).catch(handleApiError);
    return response.data;
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
    const response = await API.delete(`/api/communities/${communityId}/members/${userId}`)
      .catch((error: AxiosError<{ message?: string; error?: string }>) => {
        if (error.response?.status === 410) {
          // Community was destroyed (last member left) - treat as successful leave
          return error.response;
        }
        return handleApiError(error);
      });
    return response.data;
  }


  // --------------- Users ---------------

  static async searchUsers(query: string): Promise<{ id: string; username: string }[]> {
    const response = await API.get(`/api/users/search?q=${encodeURIComponent(query)}`).catch(handleApiError);
    return response.data.data;
  }

  static async updateProfile(data: { username?: string; email?: string; currentPassword?: string; newPassword?: string }): Promise<User> {
    const response = await API.patch("/api/users/me", JSON.stringify(data)).catch(handleApiError);
    return response.data.user;
  }


  // --------------- User Preferences ---------------

  static async getTagPreferences(): Promise<{ data: TagPreference[] }> {
    const response = await API.get("/api/users/me/tag-preferences").catch(handleApiError);
    return response.data;
  }

  static async updateTagPreference(communityId: string, showTags: boolean): Promise<{ communityId: string; showTags: boolean }> {
    const response = await API.put(`/api/users/me/tag-preferences/${communityId}`, JSON.stringify({ showTags })).catch(handleApiError);
    return response.data;
  }

  // --------------- Notifications ---------------

  static async getNotifications(params: { page?: number; limit?: number; category?: string; unreadOnly?: boolean; grouped?: boolean } = {}): Promise<NotificationsResponse> {
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
    const response = await API.patch("/api/notifications/read", JSON.stringify({ ids })).catch(handleApiError);
    return response.data;
  }

  static async markAllAsRead(category?: string): Promise<{ updated: number }> {
    const response = await API.patch("/api/notifications/read-all", JSON.stringify({ category })).catch(handleApiError);
    return response.data;
  }

  static async getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
    const response = await API.get("/api/notifications/preferences").catch(handleApiError);
    return response.data;
  }

  static async updateNotificationPreference(category: string, enabled: boolean, communityId?: string): Promise<{ category: string; enabled: boolean; communityId: string | null }> {
    const response = await API.put("/api/notifications/preferences", JSON.stringify({ category, enabled, communityId })).catch(handleApiError);
    return response.data;
  }


  // --------------- Invitations (community admin) ---------------

  static async getCommunityInvites(communityId: string, status?: string): Promise<{ data: CommunityInvite[] }> {
    const params = status ? `?status=${status}` : "";
    const response = await API.get(`/api/communities/${communityId}/invites${params}`).catch(handleApiError);
    return response.data;
  }

  static async sendInvite(communityId: string, data: { username?: string; email?: string; userId?: string }): Promise<CommunityInvite> {
    const response = await API.post(`/api/communities/${communityId}/invites`, JSON.stringify(data)).catch(handleApiError);
    return response.data;
  }

  static async cancelInvite(communityId: string, inviteId: string): Promise<{ message: string }> {
    const response = await API.delete(`/api/communities/${communityId}/invites/${inviteId}`).catch(handleApiError);
    return response.data;
  }


  // --------------- Invitations (user) ---------------

  static async getMyInvites(status?: string): Promise<{ data: ReceivedInvite[] }> {
    const params = status ? `?status=${status}` : "";
    const response = await API.get(`/api/users/me/invites${params}`).catch(handleApiError);
    return response.data;
  }

  static async acceptInvite(inviteId: string): Promise<{ message: string; community: { id: string; name: string } }> {
    const response = await API.post(`/api/invites/${inviteId}/accept`).catch(handleApiError);
    return response.data;
  }

  static async rejectInvite(inviteId: string): Promise<{ message: string }> {
    const response = await API.post(`/api/invites/${inviteId}/reject`).catch(handleApiError);
    return response.data;
  }


  // --------------- Admin Auth ---------------

  static async adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    const response = await API.post("/api/admin/auth/login", JSON.stringify({ email, password }))
      .catch(handleApiErrorWith({ 401: UnauthorizedError, 429: "Too many login attempts" }));
    return response.data;
  }

  static async adminVerifyTotp(code: string): Promise<AdminTotpResponse> {
    const response = await API.post("/api/admin/auth/totp/verify", JSON.stringify({ code }))
      .catch(handleApiErrorWith({ 401: UnauthorizedError, 429: "Too many attempts" }));
    return response.data;
  }

  static async adminLogout(): Promise<void> {
    await API.post("/api/admin/auth/logout").catch(handleApiError);
  }

  static async getLoggedInAdmin(): Promise<AdminUser> {
    const response = await API.get("/api/admin/auth/me").catch(handleApiError);
    return response.data.admin;
  }


  // --------------- Admin Dashboard ---------------

  static async getAdminDashboardStats(): Promise<DashboardStats> {
    const response = await API.get("/api/admin/dashboard/stats").catch(handleApiError);
    return response.data;
  }


  // --------------- Activity Feed ---------------

  static async getCommunityActivity(communityId: string, params: { limit?: number; offset?: number } = {}): Promise<ActivityResponse> {
    const qs = buildQueryString({ limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/communities/${communityId}/activity${qs}`).catch(handleApiError);
    return response.data;
  }

  static async getMyActivity(params: { limit?: number; offset?: number } = {}): Promise<ActivityResponse> {
    const qs = buildQueryString({ limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/users/me/activity${qs}`).catch(handleApiError);
    return response.data;
  }


  // --------------- Community Tags (moderator) ---------------

  static async getCommunityTags(communityId: string, params?: { status?: string; search?: string }): Promise<{ data: CommunityTag[]; total: number }> {
    const qs = buildQueryString({ status: params?.status, search: params?.search });
    const response = await API.get(`/api/communities/${communityId}/tags${qs}`).catch(handleApiError);
    return response.data;
  }

  static async createCommunityTag(communityId: string, name: string): Promise<CommunityTag> {
    const response = await API.post(`/api/communities/${communityId}/tags`, JSON.stringify({ name }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async updateCommunityTag(communityId: string, tagId: string, name: string): Promise<CommunityTag> {
    const response = await API.patch(`/api/communities/${communityId}/tags/${tagId}`, JSON.stringify({ name }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data;
  }

  static async deleteCommunityTag(communityId: string, tagId: string): Promise<void> {
    await API.delete(`/api/communities/${communityId}/tags/${tagId}`).catch(handleApiError);
  }

  static async approveCommunityTag(communityId: string, tagId: string): Promise<CommunityTag> {
    const response = await API.post(`/api/communities/${communityId}/tags/${tagId}/approve`).catch(handleApiError);
    return response.data;
  }

  static async rejectCommunityTag(communityId: string, tagId: string): Promise<void> {
    await API.post(`/api/communities/${communityId}/tags/${tagId}/reject`).catch(handleApiError);
  }


  // --------------- Admin Tags ---------------

  static async getAdminTags(search?: string, scope?: string): Promise<AdminTag[]> {
    const qs = buildQueryString({ search, scope });
    const response = await API.get(`/api/admin/tags${qs}`).catch(handleApiError);
    return response.data.tags;
  }

  static async createAdminTag(name: string): Promise<AdminTag> {
    const response = await API.post("/api/admin/tags", JSON.stringify({ name }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.tag;
  }

  static async updateAdminTag(id: string, name: string): Promise<AdminTag> {
    const response = await API.patch(`/api/admin/tags/${id}`, JSON.stringify({ name }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.tag;
  }

  static async deleteAdminTag(id: string): Promise<void> {
    await API.delete(`/api/admin/tags/${id}`).catch(handleApiError);
  }

  static async mergeAdminTags(sourceId: string, targetId: string): Promise<void> {
    await API.post(`/api/admin/tags/${sourceId}/merge`, JSON.stringify({ targetId })).catch(handleApiError);
  }


  // --------------- Admin Ingredients ---------------

  static async getAdminIngredients(search?: string, status?: string): Promise<AdminIngredient[]> {
    const qs = buildQueryString({ search, status });
    const response = await API.get(`/api/admin/ingredients${qs}`).catch(handleApiError);
    return response.data.ingredients;
  }

  static async createAdminIngredient(name: string, defaultUnitId?: string): Promise<AdminIngredient> {
    const response = await API.post("/api/admin/ingredients", JSON.stringify({ name, defaultUnitId }))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.ingredient;
  }

  static async updateAdminIngredient(id: string, data: { name?: string; defaultUnitId?: string | null }): Promise<AdminIngredient> {
    const response = await API.patch(`/api/admin/ingredients/${id}`, JSON.stringify(data))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.ingredient;
  }

  static async deleteAdminIngredient(id: string): Promise<void> {
    await API.delete(`/api/admin/ingredients/${id}`).catch(handleApiError);
  }

  static async mergeAdminIngredients(sourceId: string, targetId: string): Promise<void> {
    await API.post(`/api/admin/ingredients/${sourceId}/merge`, JSON.stringify({ targetId })).catch(handleApiError);
  }

  static async approveAdminIngredient(id: string, newName?: string): Promise<AdminIngredient> {
    const body = newName ? { newName } : {};
    const response = await API.post(`/api/admin/ingredients/${id}/approve`, JSON.stringify(body))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.ingredient;
  }

  static async rejectAdminIngredient(id: string, reason: string): Promise<void> {
    await API.post(`/api/admin/ingredients/${id}/reject`, JSON.stringify({ reason })).catch(handleApiError);
  }


  // --------------- Admin Units ---------------

  static async getAdminUnits(search?: string, category?: string): Promise<AdminUnit[]> {
    const qs = buildQueryString({ search, category });
    const response = await API.get(`/api/admin/units${qs}`).catch(handleApiError);
    return response.data.units;
  }

  static async createAdminUnit(data: { name: string; abbreviation: string; category: string; sortOrder?: number }): Promise<AdminUnit> {
    const response = await API.post("/api/admin/units", JSON.stringify(data))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.unit;
  }

  static async updateAdminUnit(id: string, data: { name?: string; abbreviation?: string; category?: string; sortOrder?: number }): Promise<AdminUnit> {
    const response = await API.patch(`/api/admin/units/${id}`, JSON.stringify(data))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.unit;
  }

  static async deleteAdminUnit(id: string): Promise<void> {
    await API.delete(`/api/admin/units/${id}`)
      .catch(handleApiErrorWith({ 409: "Cannot delete unit that is in use" }));
  }


  // --------------- Admin Features ---------------

  static async getAdminFeatures(): Promise<AdminFeature[]> {
    const response = await API.get("/api/admin/features").catch(handleApiError);
    return response.data.features;
  }

  static async createAdminFeature(data: { code: string; name: string; description?: string; isDefault?: boolean }): Promise<AdminFeature> {
    const response = await API.post("/api/admin/features", JSON.stringify(data))
      .catch(handleApiErrorWith({ 409: ConflictError }));
    return response.data.feature;
  }

  static async updateAdminFeature(id: string, data: { name?: string; description?: string; isDefault?: boolean }): Promise<AdminFeature> {
    const response = await API.patch(`/api/admin/features/${id}`, JSON.stringify(data)).catch(handleApiError);
    return response.data.feature;
  }


  // --------------- Admin Communities ---------------

  static async getAdminCommunities(search?: string, includeDeleted?: boolean): Promise<AdminCommunity[]> {
    const qs = buildQueryString({ search, includeDeleted: includeDeleted ? "true" : undefined });
    const response = await API.get(`/api/admin/communities${qs}`).catch(handleApiError);
    return response.data.communities;
  }

  static async getAdminCommunity(id: string): Promise<AdminCommunityDetail> {
    const response = await API.get(`/api/admin/communities/${id}`).catch(handleApiError);
    return response.data.community;
  }

  static async updateAdminCommunity(id: string, name: string): Promise<void> {
    await API.patch(`/api/admin/communities/${id}`, JSON.stringify({ name })).catch(handleApiError);
  }

  static async deleteAdminCommunity(id: string): Promise<void> {
    await API.delete(`/api/admin/communities/${id}`).catch(handleApiError);
  }

  static async grantFeature(communityId: string, featureId: string): Promise<void> {
    await API.post(`/api/admin/communities/${communityId}/features/${featureId}`).catch(handleApiError);
  }

  static async revokeFeature(communityId: string, featureId: string): Promise<void> {
    await API.delete(`/api/admin/communities/${communityId}/features/${featureId}`).catch(handleApiError);
  }


  // --------------- Admin Activity ---------------

  static async getAdminActivity(params: { type?: string; limit?: number; offset?: number } = {}): Promise<AdminActivityResponse> {
    const qs = buildQueryString({ type: params.type, limit: params.limit, offset: params.offset });
    const response = await API.get(`/api/admin/activity${qs}`).catch(handleApiError);
    return response.data;
  }

}
