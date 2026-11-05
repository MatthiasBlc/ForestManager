import { API, buildQueryString, handleApiError, handleApiErrorWith } from "./apiClient";
import {
  AdminLoginResponse,
  AdminTotpResponse,
  AdminUser,
  DashboardStats,
  AdminTag,
  AdminIngredient,
  AdminUnit,
  AdminFeature,
  AdminCommunity,
  AdminCommunityDetail,
  AdminActivityResponse,
  AdminRecipeListItem,
  AdminRecipeDetail,
  AdminRecipeUpdateInput,
  AdminChangelogEntry,
  AdminChangelogResponse,
  AdminChangelogInput,
} from "../models/admin";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

// --------------- Admin Auth ---------------

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const response = await API.post(
    "/api/admin/auth/login",
    JSON.stringify({ email, password })
  ).catch(handleApiErrorWith({ 401: UnauthorizedError, 429: "Too many login attempts" }));
  return response.data;
}

export async function adminVerifyTotp(code: string): Promise<AdminTotpResponse> {
  const response = await API.post("/api/admin/auth/totp/verify", JSON.stringify({ code })).catch(
    handleApiErrorWith({ 401: UnauthorizedError, 429: "Too many attempts" })
  );
  return response.data;
}

export async function adminLogout(): Promise<void> {
  await API.post("/api/admin/auth/logout").catch(handleApiError);
}

export async function getLoggedInAdmin(): Promise<AdminUser> {
  const response = await API.get("/api/admin/auth/me").catch(handleApiError);
  return response.data.admin;
}

// --------------- Admin Dashboard ---------------

export async function getAdminDashboardStats(): Promise<DashboardStats> {
  const response = await API.get("/api/admin/dashboard/stats").catch(handleApiError);
  return response.data;
}

// --------------- Admin Tags ---------------

export async function getAdminTags(search?: string, scope?: string): Promise<AdminTag[]> {
  const qs = buildQueryString({ search, scope });
  const response = await API.get(`/api/admin/tags${qs}`).catch(handleApiError);
  return response.data.tags;
}

export async function createAdminTag(name: string): Promise<AdminTag> {
  const response = await API.post("/api/admin/tags", JSON.stringify({ name })).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.tag;
}

export async function updateAdminTag(id: string, name: string): Promise<AdminTag> {
  const response = await API.patch(`/api/admin/tags/${id}`, JSON.stringify({ name })).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.tag;
}

export async function deleteAdminTag(id: string): Promise<void> {
  await API.delete(`/api/admin/tags/${id}`).catch(handleApiError);
}

export async function mergeAdminTags(sourceId: string, targetId: string): Promise<void> {
  await API.post(`/api/admin/tags/${sourceId}/merge`, JSON.stringify({ targetId })).catch(
    handleApiError
  );
}

// --------------- Admin Recipes ---------------

export async function getAdminTagRecipes(
  tagId: string,
  includeDeleted?: boolean
): Promise<{ recipes: AdminRecipeListItem[]; pagination: { total: number; hasMore: boolean } }> {
  const qs = buildQueryString({ includeDeleted: includeDeleted ? "true" : undefined });
  const response = await API.get(`/api/admin/tags/${tagId}/recipes${qs}`).catch(handleApiError);
  return response.data;
}

export async function getAdminRecipe(recipeId: string): Promise<AdminRecipeDetail> {
  const response = await API.get(`/api/admin/recipes/${recipeId}`).catch(handleApiError);
  return response.data.recipe;
}

export async function updateAdminRecipe(
  recipeId: string,
  data: AdminRecipeUpdateInput
): Promise<void> {
  await API.patch(`/api/admin/recipes/${recipeId}`, JSON.stringify(data)).catch(handleApiError);
}

export async function deleteAdminRecipe(recipeId: string): Promise<void> {
  await API.delete(`/api/admin/recipes/${recipeId}`).catch(handleApiError);
}

// --------------- Admin Ingredients ---------------

export async function getAdminIngredients(
  search?: string,
  status?: string
): Promise<AdminIngredient[]> {
  const qs = buildQueryString({ search, status });
  const response = await API.get(`/api/admin/ingredients${qs}`).catch(handleApiError);
  return response.data.ingredients;
}

export async function createAdminIngredient(
  name: string,
  defaultUnitId?: string
): Promise<AdminIngredient> {
  const response = await API.post(
    "/api/admin/ingredients",
    JSON.stringify({ name, defaultUnitId })
  ).catch(handleApiErrorWith({ 409: ConflictError }));
  return response.data.ingredient;
}

export async function updateAdminIngredient(
  id: string,
  data: { name?: string; defaultUnitId?: string | null }
): Promise<AdminIngredient> {
  const response = await API.patch(`/api/admin/ingredients/${id}`, JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.ingredient;
}

export async function deleteAdminIngredient(id: string): Promise<void> {
  await API.delete(`/api/admin/ingredients/${id}`).catch(handleApiError);
}

export async function mergeAdminIngredients(sourceId: string, targetId: string): Promise<void> {
  await API.post(`/api/admin/ingredients/${sourceId}/merge`, JSON.stringify({ targetId })).catch(
    handleApiError
  );
}

export async function approveAdminIngredient(
  id: string,
  newName?: string
): Promise<AdminIngredient> {
  const body = newName ? { newName } : {};
  const response = await API.post(
    `/api/admin/ingredients/${id}/approve`,
    JSON.stringify(body)
  ).catch(handleApiErrorWith({ 409: ConflictError }));
  return response.data.ingredient;
}

export async function rejectAdminIngredient(id: string, reason: string): Promise<void> {
  await API.post(`/api/admin/ingredients/${id}/reject`, JSON.stringify({ reason })).catch(
    handleApiError
  );
}

// --------------- Admin Units ---------------

export async function getAdminUnits(search?: string, category?: string): Promise<AdminUnit[]> {
  const qs = buildQueryString({ search, category });
  const response = await API.get(`/api/admin/units${qs}`).catch(handleApiError);
  return response.data.units;
}

export async function createAdminUnit(data: {
  name: string;
  abbreviation: string;
  category: string;
  sortOrder?: number;
}): Promise<AdminUnit> {
  const response = await API.post("/api/admin/units", JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.unit;
}

export async function updateAdminUnit(
  id: string,
  data: { name?: string; abbreviation?: string; category?: string; sortOrder?: number }
): Promise<AdminUnit> {
  const response = await API.patch(`/api/admin/units/${id}`, JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.unit;
}

export async function deleteAdminUnit(id: string): Promise<void> {
  await API.delete(`/api/admin/units/${id}`).catch(
    handleApiErrorWith({ 409: "Cannot delete unit that is in use" })
  );
}

// --------------- Admin Features ---------------

export async function getAdminFeatures(): Promise<AdminFeature[]> {
  const response = await API.get("/api/admin/features").catch(handleApiError);
  return response.data.features;
}

export async function createAdminFeature(data: {
  code: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}): Promise<AdminFeature> {
  const response = await API.post("/api/admin/features", JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.feature;
}

export async function updateAdminFeature(
  id: string,
  data: { name?: string; description?: string; isDefault?: boolean }
): Promise<AdminFeature> {
  const response = await API.patch(`/api/admin/features/${id}`, JSON.stringify(data)).catch(
    handleApiError
  );
  return response.data.feature;
}

// --------------- Admin Communities ---------------

export async function getAdminCommunities(
  search?: string,
  includeDeleted?: boolean
): Promise<AdminCommunity[]> {
  const qs = buildQueryString({ search, includeDeleted: includeDeleted ? "true" : undefined });
  const response = await API.get(`/api/admin/communities${qs}`).catch(handleApiError);
  return response.data.communities;
}

export async function getAdminCommunity(id: string): Promise<AdminCommunityDetail> {
  const response = await API.get(`/api/admin/communities/${id}`).catch(handleApiError);
  return response.data.community;
}

export async function updateAdminCommunity(id: string, name: string): Promise<void> {
  await API.patch(`/api/admin/communities/${id}`, JSON.stringify({ name })).catch(handleApiError);
}

export async function deleteAdminCommunity(id: string): Promise<void> {
  await API.delete(`/api/admin/communities/${id}`).catch(handleApiError);
}

export async function grantFeature(communityId: string, featureId: string): Promise<void> {
  await API.post(`/api/admin/communities/${communityId}/features/${featureId}`).catch(
    handleApiError
  );
}

export async function revokeFeature(communityId: string, featureId: string): Promise<void> {
  await API.delete(`/api/admin/communities/${communityId}/features/${featureId}`).catch(
    handleApiError
  );
}

// --------------- Admin Activity ---------------

export async function getAdminActivity(
  params: { type?: string; limit?: number; offset?: number } = {}
): Promise<AdminActivityResponse> {
  const qs = buildQueryString({ type: params.type, limit: params.limit, offset: params.offset });
  const response = await API.get(`/api/admin/activity${qs}`).catch(handleApiError);
  return response.data;
}

// --------------- Admin Changelog ---------------

export async function getAdminChangelog(
  params: { includeDeleted?: boolean; limit?: number; offset?: number } = {}
): Promise<AdminChangelogResponse> {
  const qs = buildQueryString({
    includeDeleted: params.includeDeleted ? "true" : undefined,
    limit: params.limit,
    offset: params.offset,
  });
  const response = await API.get(`/api/admin/changelog${qs}`).catch(handleApiError);
  return response.data;
}

export async function createAdminChangelog(
  data: AdminChangelogInput
): Promise<AdminChangelogEntry> {
  const response = await API.post("/api/admin/changelog", JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.data;
}

export async function updateAdminChangelog(
  id: string,
  data: Partial<AdminChangelogInput>
): Promise<AdminChangelogEntry> {
  const response = await API.patch(`/api/admin/changelog/${id}`, JSON.stringify(data)).catch(
    handleApiErrorWith({ 409: ConflictError })
  );
  return response.data.data;
}

export async function deleteAdminChangelog(id: string): Promise<void> {
  await API.delete(`/api/admin/changelog/${id}`).catch(handleApiError);
}
