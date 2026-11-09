// Module Planning [D11, D58, D180 a D184] : schemas partages par l'API et le web.
import { z } from "zod";

import { spaceRoleSchema } from "./common.ts";

/** Repas de la journee : midi et soir seulement [D11 amendee]. */
export const MEAL_TIMES = ["LUNCH", "DINNER"] as const;
export const mealTimeSchema = z.enum(MEAL_TIMES);
export type MealTime = z.infer<typeof mealTimeSchema>;

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

/** Repas tries dans l'ordre de la journee. */
export function sortMealTimes(times: readonly MealTime[]): MealTime[] {
  return [...times].sort((a, b) => MEAL_TIMES.indexOf(a) - MEAL_TIMES.indexOf(b));
}

export const MAX_SERVINGS = 50;
export const servingsSchema = z.int().min(1).max(MAX_SERVINGS);

/** Droits du lecteur sur le planning de l'espace. */
export const mealPlanRightsSchema = z.object({
  /** Modifier, echanger, verrouiller, remplacer un repas (role minimal editRole). */
  edit: z.boolean(),
  /** Reglages, profils de generation, generer (moderateurs et OWNER). */
  manage: z.boolean(),
  /** Changer le role minimal (OWNER seul). */
  setEditRole: z.boolean(),
});
export type MealPlanRights = z.infer<typeof mealPlanRightsSchema>;

export const mealPlanSettingsSchema = z.object({
  mealTimes: z.array(mealTimeSchema),
  defaultServings: z.int(),
  weekStartsOn: weekdaySchema,
  editRole: spaceRoleSchema,
  can: mealPlanRightsSchema,
});
export type MealPlanSettings = z.infer<typeof mealPlanSettingsSchema>;

export const updateMealPlanSettingsBodySchema = z.strictObject({
  mealTimes: z
    .array(mealTimeSchema)
    .min(1)
    .refine((times) => new Set(times).size === times.length, "duplicate meal time"),
  defaultServings: servingsSchema,
  weekStartsOn: weekdaySchema,
  /** Pris en compte seulement s'il change : reserve a l'OWNER. */
  editRole: spaceRoleSchema.optional(),
});
export type UpdateMealPlanSettingsBody = z.infer<typeof updateMealPlanSettingsBodySchema>;
