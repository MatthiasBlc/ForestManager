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

// --- Calendrier et repas [D180, D181, D184] ---

/** Date de calendrier sans heure (`YYYY-MM-DD`). */
export const planDateSchema = z.iso.date();

/** Plus longue periode lue ou generee d'un coup. */
export const MAX_PERIOD_DAYS = 31;

/** Nombre de jours de `from` a `to` inclus (dates ISO valides). */
export function periodDays(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

export const mealsQuerySchema = z
  .strictObject({ from: planDateSchema, to: planDateSchema })
  .refine(({ from, to }) => {
    const days = periodDays(from, to);
    return days >= 1 && days <= MAX_PERIOD_DAYS;
  }, "period must span 1 to 31 days");

export const mealCellSchema = z.strictObject({ date: planDateSchema, mealTime: mealTimeSchema });
export type MealCell = z.infer<typeof mealCellSchema>;

export const MEAL_KINDS = ["RECIPE", "TEXT", "SKIPPED"] as const;
export const mealKindSchema = z.enum(MEAL_KINDS);
export type MealKind = z.infer<typeof mealKindSchema>;

export const MEAL_TEXT_MAX = 200;
export const MEAL_COMMENT_MAX = 500;

const mealTextSchema = z.string().trim().min(1).max(MEAL_TEXT_MAX);
const mealCommentSchema = z.string().trim().max(MEAL_COMMENT_MAX).nullable().optional();

/** Ecrire un repas : recette, texte libre ou "Pas de repas" (jamais verrouille). */
export const putMealBodySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("RECIPE"),
    recipeId: z.uuid(),
    comment: mealCommentSchema,
    servings: servingsSchema.nullable().optional(),
    locked: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal("TEXT"),
    text: mealTextSchema,
    comment: mealCommentSchema,
    servings: servingsSchema.nullable().optional(),
    locked: z.boolean().optional(),
  }),
  z.strictObject({ kind: z.literal("SKIPPED"), locked: z.literal(false).optional() }),
]);
export type PutMealBody = z.infer<typeof putMealBodySchema>;

export const swapMealsBodySchema = z
  .strictObject({ a: mealCellSchema, b: mealCellSchema })
  .refine(({ a, b }) => a.date !== b.date || a.mealTime !== b.mealTime, "same cell");
export type SwapMealsBody = z.infer<typeof swapMealsBodySchema>;

export const mealSchema = z.object({
  date: planDateSchema,
  mealTime: mealTimeSchema,
  kind: mealKindSchema,
  /** Titre de la recette (ou son dernier titre connu), ou le texte ; null pour "Pas de repas". */
  title: z.string().nullable(),
  /** Recette encore visible dans l'espace ; null sinon (texte, retiree, masquee) [D184]. */
  recipe: z.object({ id: z.uuid(), imageUrl: z.string().nullable() }).nullable(),
  comment: z.string().nullable(),
  /** null = portions par defaut de l'espace. */
  servings: z.int().nullable(),
  locked: z.boolean(),
  updatedBy: z.object({ id: z.uuid(), username: z.string() }).nullable(),
  updatedAt: z.iso.datetime(),
});
export type Meal = z.infer<typeof mealSchema>;

// --- Idees de repas [D182] ---

/** Le nom devient le titre de la recette a la conversion : meme limite. */
export const MEAL_IDEA_NAME_MAX = 120;

export const mealIdeaBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(MEAL_IDEA_NAME_MAX),
  /** Vide = pas de commentaire. */
  comment: z
    .string()
    .trim()
    .max(MEAL_COMMENT_MAX)
    .nullable()
    .optional()
    .transform((comment) => comment || null),
});
export type MealIdeaBody = z.input<typeof mealIdeaBodySchema>;

export const mealIdeaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  comment: z.string().nullable(),
  /** null : compte supprime [D20]. */
  author: z.object({ id: z.uuid(), username: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  /** Auteur ou moderateurs ; transformer en recette est ouvert a tout membre. */
  can: z.object({ edit: z.boolean(), delete: z.boolean() }),
});
export type MealIdea = z.infer<typeof mealIdeaSchema>;

/** Recette enregistree depuis l'idee : creee par le lecteur dans cet espace. */
export const convertMealIdeaBodySchema = z.strictObject({ recipeId: z.uuid() });
export type ConvertMealIdeaBody = z.infer<typeof convertMealIdeaBodySchema>;
