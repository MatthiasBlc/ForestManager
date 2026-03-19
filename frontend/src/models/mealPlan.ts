// Enums
export type MealTime = "LUNCH" | "DINNER";
export type MealSlotType = "EMPTY" | "RECIPE" | "FREE_TEXT";
export type MealPlanStatus = "ACTIVE" | "ARCHIVED";

// Slot recipe info (with soft-delete flag)
export interface SlotRecipe {
  id: string;
  title: string;
  imageKey: string | null;
  isDeleted: boolean;
}

// Slot updater info
export interface SlotUpdatedBy {
  id: string;
  username: string;
}

// MealSlot
export interface MealSlot {
  id: string;
  planId: string;
  date: string;
  mealTime: MealTime;
  servings: number;
  type: MealSlotType;
  disabled: boolean;
  locked: boolean;
  recipeId: string | null;
  freeText: string | null;
  comment: string | null;
  updatedAt: string;
  recipe: SlotRecipe | null;
  updatedBy: SlotUpdatedBy | null;
}

// MealPlan
export interface MealPlan {
  id: string;
  communityId: string;
  startDate: string;
  endDate: string;
  status: MealPlanStatus;
  defaultServings: number;
  editableByMembers: boolean;
  createdAt: string;
  updatedAt: string;
  slots: MealSlot[];
}

// API response for GET /meal-plan
export interface MealPlanResponse {
  plan: MealPlan | null;
  hasDefaultGenerationParams: boolean;
}

// Archive list item (no slots, just metadata)
export interface MealPlanArchiveItem {
  id: string;
  startDate: string;
  endDate: string;
  defaultServings: number;
  createdAt: string;
  totalSlots: number;
  filledSlots: number;
}

// Archives list response
export interface MealPlanArchivesResponse {
  data: MealPlanArchiveItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Archive detail response
export interface MealPlanArchiveDetailResponse {
  plan: MealPlan;
}

// Create plan input
export interface CreateMealPlanInput {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  defaultServings?: number;
  disabledSlots?: { date: string; mealTime: MealTime }[];
  copyDisabledFromPrevious?: boolean;
}

// Update plan input
export interface UpdateMealPlanInput {
  defaultServings?: number;
  editableByMembers?: boolean;
}

// Update slot input
export interface UpdateSlotInput {
  type?: MealSlotType;
  recipeId?: string;
  freeText?: string;
  comment?: string | null;
  servings?: number;
  disabled?: boolean;
  locked?: boolean;
}

// Swap slots input
export interface SwapSlotsInput {
  slotIdA: string;
  slotIdB: string;
}

// Swap response
export interface SwapSlotsResponse {
  slotA: MealSlot;
  slotB: MealSlot;
}

// MealIdea
export interface MealIdea {
  id: string;
  communityId: string;
  name: string;
  comment: string | null;
  recipeId: string | null;
  recipe: SlotRecipe | null;
  createdBy: { id: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
}

// Ideas list response
export interface MealIdeasResponse {
  data: MealIdea[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Create/Update idea input
export interface MealIdeaInput {
  name: string;
  comment?: string | null;
  recipeId?: string | null;
}

// ==============================
// Meal Generation Params
// ==============================

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type FrequencyPer = "PER_WEEK" | "PER_PLANNING";

export interface MealSlotExclusion {
  id: string;
  day: DayOfWeek;
  mealTime: MealTime;
}

export interface MealSlotPin {
  id: string;
  day: DayOfWeek;
  mealTime: MealTime;
  tagId: string;
  tag: { id: string; name: string };
}

export interface MealGenerationRule {
  id: string;
  tagId: string | null;
  recipeId: string | null;
  weight: number;
  mealTimeConstraint: MealTime | null;
  frequencyMin: number | null;
  frequencyMax: number | null;
  frequencyPer: FrequencyPer | null;
  tagCooldownDays: number | null;
  tag: { id: string; name: string } | null;
  recipe: { id: string; title: string; isDeleted: boolean } | null;
}

export interface MealGenerationParams {
  id: string;
  name: string;
  description: string | null;
  cooldownDays: number;
  useIdeas: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  exclusions: MealSlotExclusion[];
  rules: MealGenerationRule[];
  slotPins: MealSlotPin[];
}

// List item (no nested relations)
export interface MealGenerationParamsListItem {
  id: string;
  name: string;
  description: string | null;
  cooldownDays: number;
  useIdeas: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealGenerationParamsListResponse {
  data: MealGenerationParamsListItem[];
}

export interface CreateMealGenerationParamsInput {
  name: string;
  description?: string | null;
  cooldownDays?: number;
  useIdeas?: boolean;
  isDefault?: boolean;
}

export interface UpdateMealGenerationParamsInput {
  name?: string;
  description?: string | null;
  cooldownDays?: number;
  useIdeas?: boolean;
  isDefault?: boolean;
}
