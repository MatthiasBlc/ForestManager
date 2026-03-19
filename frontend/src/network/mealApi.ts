import { API, buildQueryString, handleApiError } from "./apiClient";
import {
  MealPlan,
  MealPlanResponse,
  MealSlot,
  MealPlanArchivesResponse,
  MealPlanArchiveDetailResponse,
  CreateMealPlanInput,
  UpdateMealPlanInput,
  UpdateSlotInput,
  SwapSlotsResponse,
  MealIdea,
  MealIdeasResponse,
  MealIdeaInput,
  MealGenerationParams,
  MealGenerationParamsListResponse,
  CreateMealGenerationParamsInput,
  UpdateMealGenerationParamsInput,
  MealSlotExclusion,
  MealSlotPin,
  MealGenerationRule,
  CreateMealGenerationRuleInput,
  UpdateMealGenerationRuleInput,
  GenerateResponse,
  ReplaceSlotResponse,
} from "../models/mealPlan";

// --------------- Meal Plan ---------------

export async function getMealPlan(communityId: string): Promise<MealPlanResponse> {
  const response = await API.get(`/api/communities/${communityId}/meal-plan`).catch(handleApiError);
  return response.data;
}

export async function createMealPlan(
  communityId: string,
  data: CreateMealPlanInput
): Promise<{ plan: MealPlan }> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-plan`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function updateMealPlan(
  communityId: string,
  data: UpdateMealPlanInput
): Promise<{ plan: MealPlan }> {
  const response = await API.patch(
    `/api/communities/${communityId}/meal-plan`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function deleteMealPlan(communityId: string): Promise<void> {
  await API.delete(`/api/communities/${communityId}/meal-plan`).catch(handleApiError);
}

export async function updateMealSlot(
  communityId: string,
  slotId: string,
  data: UpdateSlotInput
): Promise<MealSlot> {
  const response = await API.patch(
    `/api/communities/${communityId}/meal-plan/slots/${slotId}`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function swapMealSlots(
  communityId: string,
  slotIdA: string,
  slotIdB: string
): Promise<SwapSlotsResponse> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-plan/slots/swap`,
    JSON.stringify({ slotIdA, slotIdB })
  ).catch(handleApiError);
  return response.data;
}

export async function getMealPlanArchives(
  communityId: string,
  params: { limit?: number; offset?: number } = {}
): Promise<MealPlanArchivesResponse> {
  const qs = buildQueryString({ limit: params.limit, offset: params.offset });
  const response = await API.get(`/api/communities/${communityId}/meal-plan/archives${qs}`).catch(
    handleApiError
  );
  return response.data;
}

export async function getMealPlanArchive(
  communityId: string,
  planId: string
): Promise<MealPlanArchiveDetailResponse> {
  const response = await API.get(
    `/api/communities/${communityId}/meal-plan/archives/${planId}`
  ).catch(handleApiError);
  return response.data;
}

export async function deleteMealPlanArchive(communityId: string, planId: string): Promise<void> {
  await API.delete(`/api/communities/${communityId}/meal-plan/archives/${planId}`).catch(
    handleApiError
  );
}

// --------------- Meal Ideas ---------------

export async function getMealIdeas(
  communityId: string,
  params: { search?: string; limit?: number; offset?: number } = {}
): Promise<MealIdeasResponse> {
  const qs = buildQueryString({
    search: params.search,
    limit: params.limit,
    offset: params.offset,
  });
  const response = await API.get(`/api/communities/${communityId}/meal-ideas${qs}`).catch(
    handleApiError
  );
  return response.data;
}

export async function createMealIdea(communityId: string, data: MealIdeaInput): Promise<MealIdea> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-ideas`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function updateMealIdea(
  communityId: string,
  ideaId: string,
  data: Partial<MealIdeaInput>
): Promise<MealIdea> {
  const response = await API.patch(
    `/api/communities/${communityId}/meal-ideas/${ideaId}`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function deleteMealIdea(communityId: string, ideaId: string): Promise<void> {
  await API.delete(`/api/communities/${communityId}/meal-ideas/${ideaId}`).catch(handleApiError);
}

// --------------- Meal Generation Params ---------------

export async function listMealGenerationParams(
  communityId: string
): Promise<MealGenerationParamsListResponse> {
  const response = await API.get(`/api/communities/${communityId}/meal-generation-params`).catch(
    handleApiError
  );
  return response.data;
}

export async function getMealGenerationParams(
  communityId: string,
  paramsId: string
): Promise<MealGenerationParams> {
  const response = await API.get(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}`
  ).catch(handleApiError);
  return response.data;
}

export async function createMealGenerationParams(
  communityId: string,
  data: CreateMealGenerationParamsInput
): Promise<MealGenerationParams> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-generation-params`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function updateMealGenerationParams(
  communityId: string,
  paramsId: string,
  data: UpdateMealGenerationParamsInput
): Promise<MealGenerationParams> {
  const response = await API.patch(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function deleteMealGenerationParams(
  communityId: string,
  paramsId: string
): Promise<void> {
  await API.delete(`/api/communities/${communityId}/meal-generation-params/${paramsId}`).catch(
    handleApiError
  );
}

export async function setMealExclusions(
  communityId: string,
  paramsId: string,
  exclusions: { day: string; mealTime: string }[]
): Promise<{ data: MealSlotExclusion[] }> {
  const response = await API.put(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}/exclusions`,
    JSON.stringify({ exclusions })
  ).catch(handleApiError);
  return response.data;
}

export async function setMealPins(
  communityId: string,
  paramsId: string,
  pins: { day: string; mealTime: string; tagId: string }[]
): Promise<{ data: MealSlotPin[] }> {
  const response = await API.put(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}/pins`,
    JSON.stringify({ pins })
  ).catch(handleApiError);
  return response.data;
}

// --------------- Meal Generation Rules ---------------

export async function createMealGenerationRule(
  communityId: string,
  paramsId: string,
  data: CreateMealGenerationRuleInput
): Promise<MealGenerationRule> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}/rules`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function updateMealGenerationRule(
  communityId: string,
  paramsId: string,
  ruleId: string,
  data: UpdateMealGenerationRuleInput
): Promise<MealGenerationRule> {
  const response = await API.patch(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}/rules/${ruleId}`,
    JSON.stringify(data)
  ).catch(handleApiError);
  return response.data;
}

export async function deleteMealGenerationRule(
  communityId: string,
  paramsId: string,
  ruleId: string
): Promise<void> {
  await API.delete(
    `/api/communities/${communityId}/meal-generation-params/${paramsId}/rules/${ruleId}`
  ).catch(handleApiError);
}

// --------------- Generation & Replace ---------------

export async function generateMealPlan(
  communityId: string,
  paramsId: string,
  fillEmptyOnly: boolean
): Promise<GenerateResponse> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-plan/generate`,
    JSON.stringify({ paramsId, fillEmptyOnly })
  ).catch(handleApiError);
  return response.data;
}

export async function replaceMealSlot(
  communityId: string,
  slotId: string,
  paramsId: string
): Promise<ReplaceSlotResponse> {
  const response = await API.post(
    `/api/communities/${communityId}/meal-plan/slots/${slotId}/replace`,
    JSON.stringify({ paramsId })
  ).catch(handleApiError);
  return response.data;
}
