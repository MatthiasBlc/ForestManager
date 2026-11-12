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

// --- Profils de generation [D113, D114, D183, D184] ---

export const PROFILE_NAME_MAX = 60;
export const PROFILE_DESCRIPTION_MAX = 300;
export const MAX_PROFILES = 20;
export const MAX_RULES = 30;
/** Delai entre deux fois la meme recette, ou deux recettes d'un meme tag (jours). */
export const MAX_COOLDOWN_DAYS = 30;
/** Une frequence porte au plus sur une periode de 31 jours a deux repas. */
export const MAX_FREQUENCY = 62;

/** Poids en cinq paliers [D184] : Jamais, Moins souvent, Normal, Plus souvent, Beaucoup plus. */
export const WEIGHT_STEPS = [0, 0.5, 1, 1.5, 2] as const;

/** Poids de 0 a 2 par pas de 0,05 (jauge 0 a 200 % du mode avance). */
export const ruleWeightSchema = z
  .number()
  .min(0)
  .max(2)
  .refine((weight) => Math.abs(weight * 20 - Math.round(weight * 20)) < 1e-9, "step of 0.05");

export const FREQUENCY_PERS = ["PER_WEEK", "PER_PERIOD"] as const;
export const frequencyPerSchema = z.enum(FREQUENCY_PERS);
export type FrequencyPer = z.infer<typeof frequencyPerSchema>;

const profileNameSchema = z.string().trim().min(1).max(PROFILE_NAME_MAX);
/** Absente : inchangee ; vide ou null : effacee. */
const profileDescriptionSchema = z
  .string()
  .trim()
  .max(PROFILE_DESCRIPTION_MAX)
  .nullable()
  .optional()
  .transform((text) => (text === undefined ? undefined : text || null));

export const createGenerationProfileBodySchema = z.strictObject({
  name: profileNameSchema,
  description: profileDescriptionSchema,
});
export type CreateGenerationProfileBody = z.input<typeof createGenerationProfileBodySchema>;

export const updateGenerationProfileBodySchema = z.strictObject({
  name: profileNameSchema.optional(),
  description: profileDescriptionSchema,
  cooldownDays: z.int().min(0).max(MAX_COOLDOWN_DAYS).optional(),
  useIdeas: z.boolean().optional(),
  /** Devenir le profil par defaut ; l'ancien cesse de l'etre [D183]. */
  isDefault: z.literal(true).optional(),
});
export type UpdateGenerationProfileBody = z.input<typeof updateGenerationProfileBodySchema>;

/** Supprimer le profil par defaut : designer celui qui le remplace [D183]. */
export const deleteGenerationProfileBodySchema = z.strictObject({ defaultId: z.uuid().optional() });

const ruleTargetBodySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("TAG"), tagId: z.uuid() }),
  z.strictObject({ kind: z.literal("RECIPE"), recipeId: z.uuid() }),
]);

const frequencySchema = z.int().min(1).max(MAX_FREQUENCY).nullable().default(null);

/**
 * Regle sur un tag ou une recette. Frequences et delai de tag : regles de tag
 * seulement. Une frequence sans periode compte par semaine (comme la V1).
 */
export const ruleBodySchema = z
  .strictObject({
    target: ruleTargetBodySchema,
    weight: ruleWeightSchema.default(1),
    /** null : midi et soir. */
    mealTime: mealTimeSchema.nullable().default(null),
    frequencyMin: frequencySchema,
    frequencyMax: frequencySchema,
    frequencyPer: frequencyPerSchema.nullable().default(null),
    tagCooldownDays: z.int().min(1).max(MAX_COOLDOWN_DAYS).nullable().default(null),
  })
  .refine(
    (rule) =>
      rule.target.kind === "TAG" ||
      (rule.frequencyMin === null && rule.frequencyMax === null && rule.tagCooldownDays === null),
    "frequency and tag cooldown apply to tag rules only"
  )
  .refine(
    (rule) =>
      rule.frequencyMin === null ||
      rule.frequencyMax === null ||
      rule.frequencyMin <= rule.frequencyMax,
    "frequencyMin must not exceed frequencyMax"
  )
  .transform((rule) => {
    const bounded = rule.frequencyMin !== null || rule.frequencyMax !== null;
    return { ...rule, frequencyPer: bounded ? (rule.frequencyPer ?? "PER_WEEK") : null };
  });
export type RuleBody = z.input<typeof ruleBodySchema>;

/** Tag tel que le voit un profil : un tag fusionne suit sa cible ; supprime, la regle dort [D184]. */
export const ruleTagSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["ACTIVE", "DELETED"]),
});
export type RuleTag = z.infer<typeof ruleTagSchema>;

export const ruleSchema = z.object({
  id: z.uuid(),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("TAG"), tag: ruleTagSchema }),
    z.object({
      kind: z.literal("RECIPE"),
      recipe: z.object({
        id: z.uuid(),
        /** null : recette plus visible dans l'espace (la regle dort). */
        title: z.string().nullable(),
      }),
    }),
  ]),
  weight: z.number(),
  mealTime: mealTimeSchema.nullable(),
  frequencyMin: z.int().nullable(),
  frequencyMax: z.int().nullable(),
  frequencyPer: frequencyPerSchema.nullable(),
  tagCooldownDays: z.int().nullable(),
});
export type Rule = z.infer<typeof ruleSchema>;

/** Case de la grille jours x repas [D114] ; une case absente est generee. */
export const gridCellSchema = z.discriminatedUnion("state", [
  z.object({ weekday: weekdaySchema, mealTime: mealTimeSchema, state: z.literal("EXCLUDED") }),
  z.object({
    weekday: weekdaySchema,
    mealTime: mealTimeSchema,
    state: z.literal("PINNED"),
    tag: ruleTagSchema,
  }),
]);
export type GridCell = z.infer<typeof gridCellSchema>;

export const putGridBodySchema = z.strictObject({
  cells: z
    .array(
      z.discriminatedUnion("state", [
        z.strictObject({
          weekday: weekdaySchema,
          mealTime: mealTimeSchema,
          state: z.literal("EXCLUDED"),
        }),
        z.strictObject({
          weekday: weekdaySchema,
          mealTime: mealTimeSchema,
          state: z.literal("PINNED"),
          tagId: z.uuid(),
        }),
      ])
    )
    .max(WEEKDAYS.length * MEAL_TIMES.length)
    .refine(
      (cells) => new Set(cells.map((c) => `${c.weekday}/${c.mealTime}`)).size === cells.length,
      "one state per cell"
    ),
});
export type PutGridBody = z.infer<typeof putGridBodySchema>;

export const generationProfileSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  ruleCount: z.int(),
});
export type GenerationProfileSummary = z.infer<typeof generationProfileSummarySchema>;

export const generationProfileSchema = generationProfileSummarySchema.extend({
  cooldownDays: z.int(),
  useIdeas: z.boolean(),
  rules: z.array(ruleSchema),
  grid: z.array(gridCellSchema),
});
export type GenerationProfile = z.infer<typeof generationProfileSchema>;

// --- Generation [D110, D113, D184] ---

/** Apercu d'une generation : rien n'est ecrit [D110]. */
export const generateBodySchema = z
  .strictObject({
    profileId: z.uuid(),
    from: planDateSchema,
    to: planDateSchema,
    /** Remplacer les repas non verrouilles ; sinon seulement les cases vides. */
    replace: z.boolean().default(false),
  })
  .refine(({ from, to }) => {
    const days = periodDays(from, to);
    return days >= 1 && days <= MAX_PERIOD_DAYS;
  }, "period must span 1 to 31 days");
export type GenerateBody = z.input<typeof generateBodySchema>;

const namedTagSchema = z.object({ id: z.uuid(), name: z.string() });

/** Pourquoi une case reste vide [D113] : la premiere contrainte qui a vide le choix. */
export const emptyReasonSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("NO_RECIPE") }),
  z.object({ code: z.literal("PIN"), tag: namedTagSchema }),
  z.object({ code: z.literal("FREQUENCY_MAX"), tags: z.array(namedTagSchema) }),
  z.object({ code: z.literal("COOLDOWN"), days: z.int() }),
  z.object({ code: z.literal("TAG_COOLDOWN"), tags: z.array(namedTagSchema) }),
  z.object({ code: z.literal("WEIGHT_ZERO") }),
]);
export type EmptyReason = z.infer<typeof emptyReasonSchema>;

export const proposedPickSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("RECIPE"), recipe: z.object({ id: z.uuid(), title: z.string() }) }),
  z.object({ kind: z.literal("IDEA"), idea: z.object({ id: z.uuid(), name: z.string() }) }),
]);
export type ProposedPick = z.infer<typeof proposedPickSchema>;

export const proposalSchema = z.object({
  date: planDateSchema,
  mealTime: mealTimeSchema,
  pick: proposedPickSchema.nullable(),
  reason: emptyReasonSchema.nullable(),
  /** Remplacer : la case n'a pas de proposition et son repas actuel reste (son nom). */
  kept: z.object({ text: z.string() }).nullable(),
  /** Etat de la case au tirage (`updatedAt`, null si vide) : "Garder" n'ecrase pas une case modifiee depuis. */
  seenUpdatedAt: z.iso.datetime().nullable(),
});
export type Proposal = z.infer<typeof proposalSchema>;

export const generationWarningSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("MIN_NOT_MET"),
    tag: namedTagSchema,
    required: z.int(),
    actual: z.int(),
    from: planDateSchema,
    to: planDateSchema,
  }),
  z.object({
    code: z.literal("MAX_EXCEEDED"),
    tag: namedTagSchema,
    max: z.int(),
    actual: z.int(),
    from: planDateSchema,
    to: planDateSchema,
  }),
]);
export type GenerationWarning = z.infer<typeof generationWarningSchema>;

export const generationPreviewSchema = z.object({
  profile: z.object({ id: z.uuid(), name: z.string() }),
  from: planDateSchema,
  to: planDateSchema,
  replace: z.boolean(),
  proposals: z.array(proposalSchema),
  skipped: z.object({
    excluded: z.int(),
    locked: z.int(),
    kept: z.int(),
    skippedMeals: z.int(),
  }),
  warnings: z.array(generationWarningSchema),
});
export type GenerationPreview = z.infer<typeof generationPreviewSchema>;

/** "Garder ce planning" : les propositions retenues, avec l'etat vu au tirage. */
export const applyGenerationBodySchema = z.strictObject({
  cells: z
    .array(
      z.strictObject({
        date: planDateSchema,
        mealTime: mealTimeSchema,
        pick: z.discriminatedUnion("kind", [
          z.strictObject({ kind: z.literal("RECIPE"), recipeId: z.uuid() }),
          z.strictObject({ kind: z.literal("IDEA"), ideaId: z.uuid() }),
        ]),
        seenUpdatedAt: z.iso.datetime().nullable(),
      })
    )
    .min(1)
    .max(MAX_PERIOD_DAYS * MEAL_TIMES.length)
    .refine(
      (cells) => new Set(cells.map((c) => `${c.date}/${c.mealTime}`)).size === cells.length,
      "one proposal per cell"
    ),
});
export type ApplyGenerationBody = z.infer<typeof applyGenerationBodySchema>;

export const applyGenerationResultSchema = z.object({
  data: z.array(mealSchema),
  /** Cases modifiees par un membre depuis le tirage (ou recette, idee disparue) : non ecrasees. */
  conflicts: z.array(mealCellSchema),
});
export type ApplyGenerationResult = z.infer<typeof applyGenerationResultSchema>;

/** "Proposer un autre repas" : le repas ecrit, ou la raison s'il n'y a rien a proposer. */
export const suggestMealResultSchema = z.object({
  meal: mealSchema.nullable(),
  reason: emptyReasonSchema.nullable(),
});
export type SuggestMealResult = z.infer<typeof suggestMealResultSchema>;
