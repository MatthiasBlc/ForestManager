// Module Liste de courses [D228, D231] : schemas partages par l'API et le web.
import { z } from "zod";

import { isoDateTimeSchema, spaceRoleSchema, userSummarySchema, uuidSchema } from "./common.ts";
import { mealTimeSchema, MAX_PERIOD_DAYS, periodDays, planDateSchema } from "./meal-plan.ts";

export const SHOPPING_LABEL_MAX = 80;
export const SHOPPING_SECTION_NAME_MAX = 40;
/** Plafonds par espace : une liste de courses reste courte. */
export const MAX_SHOPPING_SECTIONS = 30;
export const MAX_SHOPPING_ITEMS = 300;
/** Parts d'un article : une par unite non convertible ("500 g + 3"). */
export const MAX_SHOPPING_PARTS = 10;

const uniqueIds = (max: number) =>
  z
    .array(uuidSchema)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { message: "duplicate ids" });

// --- Reglages et droits ---

export const shoppingRightsSchema = z.object({
  /** Generer, ajouter, cocher, retirer, gerer les sections (role minimal editRole) [D141]. */
  edit: z.boolean(),
  /** Changer le role minimal (OWNER seul). */
  setEditRole: z.boolean(),
});
export type ShoppingRights = z.infer<typeof shoppingRightsSchema>;

export const shoppingSettingsSchema = z.object({
  editRole: spaceRoleSchema,
  can: shoppingRightsSchema,
});
export type ShoppingSettings = z.infer<typeof shoppingSettingsSchema>;

export const updateShoppingSettingsBodySchema = z.strictObject({ editRole: spaceRoleSchema });

// --- Sections ---

export const shoppingSectionSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  /** Rayon de la plateforme dont elle est issue : y range ses produits sans favorite. */
  aisleId: uuidSchema.nullable(),
});
export type ShoppingSection = z.infer<typeof shoppingSectionSchema>;

export const shoppingSectionBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(SHOPPING_SECTION_NAME_MAX),
});

/** Ordre complet des sections de l'espace ("Autres" reste en fin, sans id). */
export const sectionOrderBodySchema = z.strictObject({
  ids: uniqueIds(MAX_SHOPPING_SECTIONS).pipe(z.array(uuidSchema).min(1)),
});

// --- Articles ---

export const shoppingPartSchema = z.object({
  quantity: z.number().positive(),
  unitId: uuidSchema.nullable(),
});
export type ShoppingPartOut = z.infer<typeof shoppingPartSchema>;

const partsBodySchema = z
  .array(
    z.strictObject({ quantity: z.number().positive().max(1e6), unitId: uuidSchema.nullable() })
  )
  .max(MAX_SHOPPING_PARTS);

export const shoppingSourceSchema = z.object({
  mealSlotId: uuidSchema.nullable(),
  recipeId: uuidSchema.nullable(),
  recipeTitle: z.string(),
  date: planDateSchema,
  mealTime: mealTimeSchema,
  parts: z.array(shoppingPartSchema),
});
export type ShoppingSource = z.infer<typeof shoppingSourceSchema>;

export const shoppingItemSchema = z.object({
  id: uuidSchema,
  /** null : "Autres". */
  sectionId: uuidSchema.nullable(),
  ingredient: z
    .object({ id: uuidSchema, name: z.string(), namePlural: z.string().nullable() })
    .nullable(),
  /** Texte libre (eponge), quand ce n'est pas un ingredient. */
  label: z.string().nullable(),
  parts: z.array(shoppingPartSchema),
  sortOrder: z.number().int(),
  checkedAt: isoDateTimeSchema.nullable(),
  checkedBy: userSummarySchema.nullable(),
  sources: z.array(shoppingSourceSchema),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingListSchema = z.object({
  sections: z.array(shoppingSectionSchema),
  items: z.array(shoppingItemSchema),
  can: shoppingRightsSchema,
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

/** Article a la main : un ingredient du catalogue ou un texte libre, quantite facultative. */
export const createShoppingItemBodySchema = z
  .strictObject({
    ingredientId: uuidSchema.optional(),
    label: z.string().trim().min(1).max(SHOPPING_LABEL_MAX).optional(),
    parts: partsBodySchema.default([]),
  })
  .refine((body) => (body.ingredientId === undefined) !== (body.label === undefined), {
    message: "ingredientId or label, not both",
  });
export type CreateShoppingItemBody = z.infer<typeof createShoppingItemBodySchema>;

export const updateShoppingItemBodySchema = z
  .strictObject({
    parts: partsBodySchema.optional(),
    checked: z.boolean().optional(),
    /** Heure de la coche cote client : une coche hors ligne plus ancienne est ignoree. */
    checkedChangedAt: isoDateTimeSchema.optional(),
    /** null : "Autres". */
    sectionId: uuidSchema.nullable().optional(),
    /** "Toujours ranger ici" : la section devient la favorite du produit [D231]. */
    rememberSection: z.literal(true).optional(),
  })
  .refine(
    (body) =>
      body.parts !== undefined || body.checked !== undefined || body.sectionId !== undefined,
    {
      message: "nothing to update",
    }
  );
export type UpdateShoppingItemBody = z.infer<typeof updateShoppingItemBodySchema>;

/** Ordre complet des articles d'une section (null : "Autres"). */
export const shoppingItemOrderBodySchema = z.strictObject({
  sectionId: uuidSchema.nullable(),
  ids: uniqueIds(MAX_SHOPPING_ITEMS),
});

/** Articles retires par "Retirer les achetes", renvoyes tels quels par l'Annuler du toast. */
export const restoreShoppingItemsBodySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: uuidSchema,
        sectionId: uuidSchema.nullable(),
        ingredientId: uuidSchema.nullable(),
        label: z.string().trim().min(1).max(SHOPPING_LABEL_MAX).nullable(),
        parts: partsBodySchema,
        sortOrder: z.number().int(),
        checkedAt: isoDateTimeSchema.nullable(),
        sources: z
          .array(
            z.strictObject({
              mealSlotId: uuidSchema.nullable(),
              recipeId: uuidSchema.nullable(),
              recipeTitle: z.string().min(1).max(200),
              date: planDateSchema,
              mealTime: mealTimeSchema,
              parts: partsBodySchema,
            })
          )
          .max(100),
      })
    )
    .min(1)
    .max(MAX_SHOPPING_ITEMS),
});
export type RestoreShoppingItemsBody = z.infer<typeof restoreShoppingItemsBodySchema>;

// --- Depuis le planning [D228] ---

const periodSchema = { from: planDateSchema, to: planDateSchema };
const validPeriod = ({ from, to }: { from: string; to: string }) => {
  const days = periodDays(from, to);
  return days >= 1 && days <= MAX_PERIOD_DAYS;
};

export const planPreviewBodySchema = z
  .strictObject(periodSchema)
  .refine(validPeriod, "period must span 1 to 31 days");

export const planPreviewLineSchema = z.object({
  ingredient: z.object({ id: uuidSchema, name: z.string(), namePlural: z.string().nullable() }),
  /** Section ou il ira (null : "Autres"). */
  sectionId: uuidSchema.nullable(),
  parts: z.array(shoppingPartSchema),
  /** Decochee par defaut : toutes ses lignes de recette sont facultatives. */
  optional: z.boolean(),
  /** Une recette au rendement hors portions : quantites telles quelles, a verifier. */
  toCheck: z.boolean(),
  /** Deja dans la liste, dans la meme section (non achete) : ses parts actuelles. */
  inList: z.array(shoppingPartSchema).nullable(),
  sources: z.array(shoppingSourceSchema),
});
export type PlanPreviewLine = z.infer<typeof planPreviewLineSchema>;

const mealRefSchema = z.object({
  date: planDateSchema,
  mealTime: mealTimeSchema,
  title: z.string(),
});

export const planPreviewSchema = z.object({
  lines: z.array(planPreviewLineSchema),
  /** Repas dont les ingredients sont deja dans la liste. */
  addedMeals: z.array(mealRefSchema),
  /** Repas sans recette (texte libre, saute) ou recette invisible : hors liste. */
  skippedMeals: z.array(mealRefSchema),
  /** Sous-recettes invisibles : leurs ingredients manquent [D24, D26]. */
  missingSubRecipes: z.array(z.object({ title: z.string(), inRecipe: z.string() })),
});
export type PlanPreview = z.infer<typeof planPreviewSchema>;

/** Ajouter les lignes cochees de l'apercu : le serveur recalcule et fusionne. */
export const applyPlanBodySchema = z
  .strictObject({
    ...periodSchema,
    ingredientIds: uniqueIds(MAX_SHOPPING_ITEMS).pipe(z.array(uuidSchema).min(1)),
  })
  .refine(validPeriod, "period must span 1 to 31 days");
export type ApplyPlanBody = z.infer<typeof applyPlanBodySchema>;

export const applyPlanResultSchema = z.object({
  added: z.number().int(),
  updated: z.number().int(),
});
