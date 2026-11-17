// Admin, referentiels (C4.3) : ingredients et fusion [D120], poids par unite [D46],
// unites, rayons [D125], tags globaux. Noms saisis en francais et en anglais [D34].

import { z } from "zod";

import { UNIT_DIMENSIONS } from "../units/index.ts";
import { offsetQuerySchema } from "./admin.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";
import { INGREDIENT_NAME_MAX, TAG_NAME_MAX } from "./referentials.ts";

/** Texte facultatif : vide ou absent = null. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));
}

// --- Ingredients ---

export const ADMIN_INGREDIENT_TABS = ["NEW", "VERIFIED", "UNTRANSLATED", "NO_AISLE"] as const;
export type AdminIngredientTab = (typeof ADMIN_INGREDIENT_TABS)[number];

/** Sans onglet : tous les ingredients non fusionnes (recherche d'une cible de fusion). */
export const adminIngredientsQuerySchema = offsetQuerySchema.extend({
  tab: z.enum(ADMIN_INGREDIENT_TABS).optional(),
  query: z.string().trim().max(INGREDIENT_NAME_MAX).optional(),
});

const ingredientStatusSchema = z.enum(["NEW", "ACTIVE", "MERGED"]);

export const adminIngredientItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  status: ingredientStatusSchema,
  createdAt: isoDateTimeSchema,
  /** Username du createur ; null si cree par l'admin ou compte supprime. */
  createdBy: z.string().nullable(),
  recipeCount: z.number().int(),
  /** Nouveau qui ressemble a un ingredient verifie (pg_trgm). */
  probableDuplicate: z.boolean(),
});
export type AdminIngredientItem = z.infer<typeof adminIngredientItemSchema>;

export const adminIngredientListSchema = z.object({
  data: z.array(adminIngredientItemSchema),
  total: z.number().int(),
  /** Compteurs des onglets, sans tenir compte de la recherche. */
  counts: z.object({
    NEW: z.number().int(),
    VERIFIED: z.number().int(),
    UNTRANSLATED: z.number().int(),
    NO_AISLE: z.number().int(),
  }),
});

const namePairSchema = z.object({ name: z.string(), namePlural: z.string().nullable() });

export const adminIngredientSchema = z.object({
  id: uuidSchema,
  status: ingredientStatusSchema,
  fr: namePairSchema,
  en: namePairSchema.nullable(),
  aisleId: uuidSchema.nullable(),
  defaultUnitId: uuidSchema.nullable(),
  unitWeights: z.array(z.object({ unitId: uuidSchema, grams: z.number() })),
  createdAt: isoDateTimeSchema,
  createdBy: z.string().nullable(),
  recipeCount: z.number().int(),
  /** Quelques recettes qui l'utilisent (annonce de la fusion). */
  recipes: z.array(z.object({ id: uuidSchema, title: z.string(), author: z.string() })),
  /** Noms des ingredients fusionnes dans celui-ci. */
  synonyms: z.array(z.string()),
  mergedInto: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  /** Ingredients qui lui ressemblent, du plus proche au plus lointain. */
  similar: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      status: ingredientStatusSchema,
      recipeCount: z.number().int(),
      aisleId: uuidSchema.nullable(),
      en: z.string().nullable(),
    })
  ),
  /** Ingredient verifie dont celui-ci est probablement un doublon. */
  duplicateOfId: uuidSchema.nullable(),
});
export type AdminIngredient = z.infer<typeof adminIngredientSchema>;

const nameInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(INGREDIENT_NAME_MAX),
  namePlural: optionalText(INGREDIENT_NAME_MAX),
});

export const createAdminIngredientBodySchema = z.strictObject({
  fr: nameInputSchema,
  en: nameInputSchema.nullish().transform((value) => value ?? null),
});

export const UNIT_WEIGHT_MAX_GRAMS = 100_000;

export const updateAdminIngredientBodySchema = z.strictObject({
  fr: nameInputSchema,
  en: nameInputSchema.nullable(),
  aisleId: uuidSchema.nullable(),
  defaultUnitId: uuidSchema.nullable(),
  /** Poids d'une piece (unites COUNT seulement) [D46]. */
  unitWeights: z
    .array(
      z.strictObject({
        unitId: uuidSchema,
        grams: z.number().positive().max(UNIT_WEIGHT_MAX_GRAMS),
      })
    )
    .max(20)
    .refine((list) => new Set(list.map((w) => w.unitId)).size === list.length, {
      message: "Une seule fois par unité.",
    }),
  /** "Marquer comme verifie" : enregistre et passe en ACTIVE. */
  verify: z.boolean().default(false),
});
export type UpdateAdminIngredientBody = z.input<typeof updateAdminIngredientBodySchema>;

export const mergeIngredientBodySchema = z.strictObject({ intoId: uuidSchema });

// --- Unites ---

const unitNamesSchema = z.object({
  name: z.string(),
  namePlural: z.string().nullable(),
  abbreviation: z.string(),
});

export const adminUnitSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  dimension: z.enum(UNIT_DIMENSIONS),
  toBase: z.number().nullable(),
  metric: z.boolean(),
  fr: unitNamesSchema,
  en: unitNamesSchema.nullable(),
});
export type AdminUnit = z.infer<typeof adminUnitSchema>;

const unitNamesInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  namePlural: optionalText(40),
  abbreviation: z.string().trim().min(1).max(20),
});

/** Masse et volume ont un facteur vers la base (g, ml) ; pieces et "a gout" n'en ont pas. */
const unitFields = {
  dimension: z.enum(UNIT_DIMENSIONS),
  toBase: z.number().positive().max(1_000_000).nullable(),
  metric: z.boolean().default(false),
  fr: unitNamesInputSchema,
  en: unitNamesInputSchema.nullish().transform((value) => value ?? null),
};

function withBaseRule(value: { dimension: string; toBase: number | null }) {
  return (value.dimension === "MASS" || value.dimension === "VOLUME") === (value.toBase !== null);
}
const baseRuleMessage = {
  message: "Facteur vers la base requis pour une masse ou un volume, absent sinon.",
  path: ["toBase"],
};

export const createAdminUnitBodySchema = z
  .strictObject({ code: z.string().regex(/^[a-z][a-z0-9-]{0,19}$/), ...unitFields })
  .refine(withBaseRule, baseRuleMessage);
export const updateAdminUnitBodySchema = z
  .strictObject(unitFields)
  .refine(withBaseRule, baseRuleMessage);
export type AdminUnitBody = z.input<typeof updateAdminUnitBodySchema>;

// --- Rayons ---

export const AISLE_NAME_MAX = 60;

export const adminAisleSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  fr: z.string(),
  en: z.string().nullable(),
  ingredientCount: z.number().int(),
});
export type AdminAisle = z.infer<typeof adminAisleSchema>;

export const adminAislesSchema = z.object({
  /** Dans l'ordre du parcours en magasin. */
  data: z.array(adminAisleSchema),
  /** Ingredients sans rayon ("Autres" en fin de liste de courses). */
  unclassifiedCount: z.number().int(),
});

export const adminAisleBodySchema = z.strictObject({
  fr: z.string().trim().min(1).max(AISLE_NAME_MAX),
  en: optionalText(AISLE_NAME_MAX),
});

export const aisleOrderBodySchema = z.strictObject({
  ids: z.array(uuidSchema).min(1).max(100),
});

// --- Tags globaux ---

export const adminTagSchema = z.object({
  id: uuidSchema,
  fr: z.string(),
  en: z.string().nullable(),
  recipeCount: z.number().int(),
});
export type AdminTag = z.infer<typeof adminTagSchema>;

export const adminTagBodySchema = z.strictObject({
  fr: z.string().trim().min(1).max(TAG_NAME_MAX),
  en: optionalText(TAG_NAME_MAX),
});
