import axios, { AxiosError } from "axios";
import { RecipeDetail, RecipesResponse, CommunityRecipesResponse, TagSearchResult, IngredientSearchResult, Proposal, ProposalsResponse, ProposalInput, VariantsResponse, RejectProposalResponse } from "../models/recipe";
import { ActivityResponse } from "../models/activity";
import { User } from "../models/user";
import { AdminLoginResponse, AdminTotpResponse, AdminUser, DashboardStats } from "../models/admin";
import { CommunityListItem, CommunityDetail, CommunityMember, CommunityInvite, ReceivedInvite } from "../models/community";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
const API = axios.create({ withCredentials: true, baseURL: apiUrl });

API.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/json";
  return config;
});

// Utility function to handle API errors safely
function handleApiError(error: AxiosError<{ error?: string }>): never {
  console.error(error);
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
    `Request failed with status: ${error.response.status} message ${error.response.data?.error || "Unknown error"}`
  );
}


export interface RecipeInput {
  title: string;
  content: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: { name: string; quantity?: string }[];
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
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.offset) queryParams.set("offset", params.offset.toString());
    if (params.tags && params.tags.length > 0) queryParams.set("tags", params.tags.join(","));
    if (params.ingredients && params.ingredients.length > 0) queryParams.set("ingredients", params.ingredients.join(","));
    if (params.search) queryParams.set("search", params.search);

    const queryString = queryParams.toString();
    const url = `/api/recipes${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data;
  }

  static async getRecipe(recipeId: string): Promise<RecipeDetail> {
    const response = await API.get(`/api/recipes/${recipeId}`)
      .catch(error => {
        if (!error.response) {
          throw new Error("Network error - please check your connection");
        }
        if (error.response.status === 404) {
          throw new Error("Recipe not found");
        }
        if (error.response.status === 403) {
          throw new Error("Cannot access this recipe");
        }
        return handleApiError(error);
      });
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
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.offset) queryParams.set("offset", params.offset.toString());
    if (params.tags && params.tags.length > 0) queryParams.set("tags", params.tags.join(","));
    if (params.ingredients && params.ingredients.length > 0) queryParams.set("ingredients", params.ingredients.join(","));
    if (params.search) queryParams.set("search", params.search);

    const queryString = queryParams.toString();
    const url = `/api/communities/${communityId}/recipes${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
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
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.error || "Cannot create proposal");
        }
        return handleApiError(error);
      });
    return response.data;
  }

  static async getProposal(proposalId: string): Promise<Proposal> {
    const response = await API.get(`/api/proposals/${proposalId}`).catch(handleApiError);
    return response.data;
  }

  static async acceptProposal(proposalId: string): Promise<Proposal> {
    const response = await API.post(`/api/proposals/${proposalId}/accept`)
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 409) {
          throw new ConflictError(error.response.data?.error || "Recipe has been modified");
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.error || "Cannot accept proposal");
        }
        return handleApiError(error);
      });
    return response.data;
  }

  static async rejectProposal(proposalId: string): Promise<RejectProposalResponse> {
    const response = await API.post(`/api/proposals/${proposalId}/reject`)
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.error || "Cannot reject proposal");
        }
        return handleApiError(error);
      });
    return response.data;
  }


  // --------------- Variants ---------------

  static async getRecipeVariants(recipeId: string, limit?: number, offset?: number): Promise<VariantsResponse> {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.set("limit", limit.toString());
    if (offset) queryParams.set("offset", offset.toString());
    const queryString = queryParams.toString();
    const url = `/api/recipes/${recipeId}/variants${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data;
  }


  // --------------- Tags ---------------

  static async searchTags(search: string = "", limit: number = 20): Promise<TagSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (limit) queryParams.set("limit", limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/tags${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data.data;
  }


  // --------------- Ingredients ---------------

  static async searchIngredients(search: string = "", limit: number = 20): Promise<IngredientSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (limit) queryParams.set("limit", limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/ingredients${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data.data;
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
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response?.status === 429) {
          throw new Error(error.response.data.error || "Too many login attempts");
        } else {
          throw new Error(error.response?.data?.error || "Login failed");
        }
      });
    return response.data;
  }

  static async adminVerifyTotp(code: string): Promise<AdminTotpResponse> {
    const response = await API.post("/api/admin/auth/totp/verify", JSON.stringify({ code }))
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response?.status === 429) {
          throw new Error(error.response.data.error || "Too many attempts");
        } else {
          throw new Error(error.response?.data?.error || "TOTP verification failed");
        }
      });
    return response.data;
  }

  static async adminLogout(): Promise<void> {
    await API.post("/api/admin/auth/logout")
      .catch((error: AxiosError<{ error?: string }>) => {
        throw new Error(error.response?.data?.error || "Logout failed");
      });
  }

  static async getLoggedInAdmin(): Promise<AdminUser> {
    const response = await API.get("/api/admin/auth/me")
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw new Error(error.response?.data?.error || "Failed to get admin info");
        }
      });
    return response.data.admin;
  }


  // --------------- Admin Dashboard ---------------

  static async getAdminDashboardStats(): Promise<DashboardStats> {
    const response = await API.get("/api/admin/dashboard/stats")
      .catch((error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw new Error(error.response?.data?.error || "Failed to load dashboard");
        }
      });
    return response.data;
  }


  // --------------- Activity Feed ---------------

  static async getCommunityActivity(communityId: string, params: { limit?: number; offset?: number } = {}): Promise<ActivityResponse> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.offset) queryParams.set("offset", params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/api/communities/${communityId}/activity${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data;
  }

  static async getMyActivity(params: { limit?: number; offset?: number } = {}): Promise<ActivityResponse> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.offset) queryParams.set("offset", params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/api/users/me/activity${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url).catch(handleApiError);
    return response.data;
  }

}
