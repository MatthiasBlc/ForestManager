// Module Recettes : contenu d'une recette, liste et filtres [D03, D05, D19, D24].
// C3.2 : blocs LOCAL seulement ; les blocs RECIPE (lien vivant) arrivent en C3.4.
import { z } from "zod";

import { cursorQuerySchema, isoDateTimeSchema, userSummarySchema, uuidSchema } from "./common.ts";
import { tagSchema } from "./referentials.ts";

export const RECIPE_TITLE_MAX = 120;
export const RECIPE_DESCRIPTION_MAX = 1000;
export const RECIPE_NOTES_MAX = 5000;
export const RECIPE_URL_MAX = 2000;
export const RECIPE_STEP_MAX = 2000;
export const RECIPE_INGREDIENT_NOTE_MAX = 120;
export const RECIPE_BLOCK_TITLE_MAX = 80;
export const RECIPE_BLOCKS_MAX = 20;
export const RECIPE_LINES_MAX = 100;
export const RECIPE_TAGS_MAX = 20;
export const RECIPE_MINUTES_MAX = 10_000;
export const RECIPE_YIELD_MAX = 10_000;

/** Texte optionnel : vide ou blanc = absent (null). */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));
}

const minutesSchema = z
  .number()
  .int()
  .min(0)
  .max(RECIPE_MINUTES_MAX)
  .nullish()
  .transform((v) => v ?? null);

/** Lien http(s) seulement (pas de javascript:, data:...). */
const sourceUrlSchema = z
  .string()
  .trim()
  .max(RECIPE_URL_MAX)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value), {
    message: "URL http(s) attendue",
  });

const tagIdsSchema = z
  .array(uuidSchema)
  .max(RECIPE_TAGS_MAX)
  .default([])
  .transform((ids) => [...new Set(ids)]);

export const recipeIngredientInputSchema = z.strictObject({
  ingredientId: uuidSchema,
  /** null = "a gout" ou "selon besoin". */
  quantity: z.number().positive().max(1_000_000).nullable(),
  unitId: uuidSchema.nullable(),
  note: optionalText(RECIPE_INGREDIENT_NOTE_MAX),
  optional: z.boolean().default(false),
});
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>;

export const localBlockInputSchema = z.strictObject({
  kind: z.literal("LOCAL"),
  title: optionalText(RECIPE_BLOCK_TITLE_MAX),
  ingredients: z.array(recipeIngredientInputSchema).max(RECIPE_LINES_MAX),
  steps: z.array(z.string().trim().min(1).max(RECIPE_STEP_MAX)).max(RECIPE_LINES_MAX),
});
export type LocalBlockInput = z.infer<typeof localBlockInputSchema>;

/**
 * Lien vivant vers une autre recette [D24] : quantite utilisee dans l'unite de
 * rendement de la sous-recette [D107] (`unitId` null = portions).
 */
export const linkedBlockInputSchema = z.strictObject({
  kind: z.literal("RECIPE"),
  recipeId: uuidSchema,
  quantity: z.number().positive().max(RECIPE_YIELD_MAX),
  unitId: uuidSchema.nullable(),
});
export type LinkedBlockInput = z.infer<typeof linkedBlockInputSchema>;

export const blockInputSchema = z.discriminatedUnion("kind", [
  localBlockInputSchema,
  linkedBlockInputSchema,
]);
export type BlockInput = z.infer<typeof blockInputSchema>;

/** Contenu commun a la creation et a la modification. */
const recipeContentShape = {
  title: z.string().trim().min(1).max(RECIPE_TITLE_MAX),
  description: optionalText(RECIPE_DESCRIPTION_MAX),
  notes: optionalText(RECIPE_NOTES_MAX),
  sourceUrl: sourceUrlSchema,
  yieldQuantity: z.number().positive().max(RECIPE_YIELD_MAX),
  /** null = portions. */
  yieldUnitId: uuidSchema.nullish().transform((v) => v ?? null),
  prepMinutes: minutesSchema,
  cookMinutes: minutesSchema,
  restMinutes: minutesSchema,
  isBase: z.boolean().default(false),
  blocks: z.array(blockInputSchema).min(1).max(RECIPE_BLOCKS_MAX),
  /** Tags globaux : suivent la recette, memes droits que modifier [D19]. */
  globalTagIds: tagIdsSchema,
  /** Tags de l'espace courant [D19]. */
  spaceTagIds: tagIdsSchema,
};

export const createRecipeBodySchema = z.strictObject({
  ...recipeContentShape,
  /** Recette relue apres un import (lien ou texte) : revision IMPORT (C3.8). */
  imported: z.boolean().optional(),
});
export type CreateRecipeBody = z.input<typeof createRecipeBodySchema>;

/** `revision` : revision sur laquelle l'edition est basee (refus si depassee). */
export const updateRecipeBodySchema = z.strictObject({
  ...recipeContentShape,
  revision: z.number().int().min(1),
});
export type UpdateRecipeBody = z.input<typeof updateRecipeBodySchema>;

export const recipeSpaceTagsBodySchema = z.strictObject({ tagIds: tagIdsSchema });

export const recipeParamsSchema = z.strictObject({ spaceId: uuidSchema, recipeId: uuidSchema });

// --- Sorties ---

export const recipeIngredientSchema = z.object({
  ingredientId: uuidSchema,
  name: z.string(),
  namePlural: z.string().nullable(),
  quantity: z.number().nullable(),
  unitId: uuidSchema.nullable(),
  note: z.string().nullable(),
  optional: z.boolean(),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const localBlockSchema = z.object({
  kind: z.literal("LOCAL"),
  title: z.string().nullable(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(z.string()),
});
export type LocalBlock = z.infer<typeof localBlockSchema>;

/** AVAILABLE : visible ici ; HIDDEN : pas visible dans cet espace ; DELETED : supprimee. */
export const LINK_STATUSES = ["AVAILABLE", "HIDDEN", "DELETED"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/** Sous-recette telle qu'affichee dans le plat (version actuelle, lien vivant). */
export interface LinkedRecipe {
  id: string;
  title: string;
  yieldQuantity: number;
  yieldUnitId: string | null;
  isBase: boolean;
  blocks: RecipeBlock[];
}

export interface LinkedBlock {
  kind: "RECIPE";
  recipeId: string;
  /** Quantite utilisee, dans l'unite `unitId` (rendement de la sous-recette). */
  quantity: number;
  unitId: string | null;
  status: LinkStatus;
  /** null sauf si AVAILABLE. */
  recipe: LinkedRecipe | null;
}

export type RecipeBlock = LocalBlock | LinkedBlock;

const linkedRecipeSchema: z.ZodType<LinkedRecipe> = z.object({
  id: uuidSchema,
  title: z.string(),
  yieldQuantity: z.number(),
  yieldUnitId: uuidSchema.nullable(),
  isBase: z.boolean(),
  get blocks() {
    return z.array(recipeBlockSchema);
  },
});

export const linkedBlockSchema: z.ZodType<LinkedBlock> = z.object({
  kind: z.literal("RECIPE"),
  recipeId: uuidSchema,
  quantity: z.number(),
  unitId: uuidSchema.nullable(),
  status: z.enum(LINK_STATUSES),
  recipe: linkedRecipeSchema.nullable(),
});

export const recipeBlockSchema: z.ZodType<RecipeBlock> = z.union([
  localBlockSchema,
  linkedBlockSchema,
]);

/** Espace designe par son nom (origine, partage). */
export const spaceRefSchema = z.object({ id: uuidSchema, name: z.string() });
export type SpaceRef = z.infer<typeof spaceRefSchema>;

const MAX_SHARE_TARGETS = 50;

const recipeBaseShape = {
  id: uuidSchema,
  homeSpaceId: uuidSchema,
  title: z.string(),
  imageUrl: z.string().nullable(),
  yieldQuantity: z.number(),
  yieldUnitId: uuidSchema.nullable(),
  /** Somme des temps renseignes ; null si aucun. */
  totalMinutes: z.number().int().nullable(),
  isBase: z.boolean(),
  author: userSummarySchema,
  tags: z.array(tagSchema),
  updatedAt: isoDateTimeSchema,
};

export const recipeSummarySchema = z.object({
  ...recipeBaseShape,
  /** Au moins un bloc lie a une autre recette (C3.4). */
  isComposed: z.boolean(),
});
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

export const recipeSchema = z.object({
  ...recipeBaseShape,
  description: z.string().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  restMinutes: z.number().int().nullable(),
  currentRevision: z.number().int(),
  createdAt: isoDateTimeSchema,
  blocks: z.array(recipeBlockSchema),
  /** Recettes non supprimees qui lient celle-ci (prevenir avant suppression). */
  usedBy: z.number().int(),
  /** Espace d'origine (affiche "par Lea - Foyer" dans un espace de partage). */
  homeSpace: spaceRefSchema,
  /** Nombre d'espaces de partage actifs [F-REC-13]. */
  shareCount: z.number().int(),
  /** Espaces de partage dont l'utilisateur courant est membre (confirmation de suppression). */
  sharedIn: z.array(spaceRefSchema),
  /** Adaptation : original lie [D17] ; null pour une recette qui n'en est pas une. */
  adaptedFrom: z
    .object({
      id: uuidSchema,
      title: z.string(),
      author: userSummarySchema,
      homeSpace: spaceRefSchema,
      /** Original supprime : l'adaptation vit seule. */
      deleted: z.boolean(),
      /** L'original a change depuis la derniere revision vue ("Original modifie"). */
      changed: z.boolean(),
    })
    .nullable(),
  /** Adaptations non supprimees de cette recette [F-REC-13]. */
  adaptationCount: z.number().int(),
  /** Masquee par la moderation [D178] : seul son auteur la voit encore, avec le motif. */
  hidden: z.object({ reason: z.string() }).nullable(),
  /** Droits de l'utilisateur courant sur cette recette, dans cet espace. */
  can: z.object({
    edit: z.boolean(),
    delete: z.boolean(),
    /** Partager directement (auteur, ou moderateurs de l'origine si l'auteur est parti) [D81]. */
    share: z.boolean(),
    /** Retirer de cet espace de partage (auteur, MOD et OWNER de cet espace) [F-REC-9]. */
    removeFromSpace: z.boolean(),
  }),
});
export type Recipe = z.infer<typeof recipeSchema>;

// --- Revisions [D05, D30, D55] ---

export const REVISION_SOURCES = ["CREATE", "EDIT", "SUGGESTION", "RESTORE", "IMPORT"] as const;
export type RevisionSource = (typeof REVISION_SOURCES)[number];

/** Parties de la recette qui different de la revision precedente. */
export const REVISION_CHANGES = [
  "title",
  "description",
  "notes",
  "source",
  "yield",
  "times",
  "base",
  "blocks",
  "ingredients",
  "steps",
] as const;
export type RevisionChange = (typeof REVISION_CHANGES)[number];

export const recipeRevisionSchema = z.object({
  number: z.number().int(),
  source: z.enum(REVISION_SOURCES),
  author: userSummarySchema,
  createdAt: isoDateTimeSchema,
  /** Vide pour la premiere revision. */
  changes: z.array(z.enum(REVISION_CHANGES)),
});
export type RecipeRevision = z.infer<typeof recipeRevisionSchema>;

export const revisionParamsSchema = recipeParamsSchema.extend({
  number: z.coerce.number().int().min(1),
});

/** `revision` : revision courante vue par le client (verrou optimiste, D163). */
export const restoreRevisionBodySchema = z.strictObject({
  revision: z.number().int().min(1),
});
export type RestoreRevisionBody = z.infer<typeof restoreRevisionBodySchema>;

// --- Liste ---

export const RECIPE_SORTS = ["recent", "title", "time"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

/** Liste d'UUID separes par des virgules dans la query string. */
const uuidListSchema = z
  .string()
  .max(40 * RECIPE_TAGS_MAX)
  .transform((value) => value.split(",").filter(Boolean))
  .pipe(z.array(uuidSchema).max(RECIPE_TAGS_MAX));

export const recipeListQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(RECIPE_TITLE_MAX).optional(),
  tagIds: uuidListSchema.optional(),
  ingredientIds: uuidListSchema.optional(),
  maxMinutes: z.coerce.number().int().min(1).max(RECIPE_MINUTES_MAX).optional(),
  authorId: uuidSchema.optional(),
  base: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(RECIPE_SORTS).default("recent"),
});
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;

// --- Partage [D03, D26, D81, D82, D84] ---

export const SHARE_STATUSES = ["SHARED", "PENDING"] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];
export const SHARE_REQUEST_MESSAGE_MAX = 280;

/** Etat du partage vu par l'utilisateur courant (F-PARTAGER). */
export const recipeSharingSchema = z.object({
  homeSpace: spaceRefSchema,
  /** true : cases a cocher ; false : demande a l'auteur (F-PARTAGER-Demande). */
  canShare: z.boolean(),
  /** Espaces de l'utilisateur (hors origine) ou la recette est partagee ou demandee. */
  spaces: z.array(z.object({ spaceId: uuidSchema, status: z.enum(SHARE_STATUSES) })),
  /** Sous-recettes : partagees avec le plat si elles sont du meme auteur [D26]. */
  withIt: z.array(z.object({ id: uuidSchema, title: z.string(), included: z.boolean() })),
});
export type RecipeSharing = z.infer<typeof recipeSharingSchema>;

/** Espaces ou la recette doit etre partagee ; les autres espaces de l'utilisateur sont retires. */
export const recipeSharesBodySchema = z.strictObject({
  spaceIds: z.array(uuidSchema).max(MAX_SHARE_TARGETS),
});
export type RecipeSharesBody = z.infer<typeof recipeSharesBodySchema>;

export const shareRequestBodySchema = z.strictObject({
  targetSpaceId: uuidSchema,
  message: z.string().trim().max(SHARE_REQUEST_MESSAGE_MAX).optional(),
});
export type ShareRequestBody = z.infer<typeof shareRequestBodySchema>;

/** SHARED : partage immediat (confiance de l'auteur ou droit de partager) [D81]. */
export const shareRequestResultSchema = z.object({ status: z.enum(SHARE_STATUSES) });

export const shareRequestSchema = z.object({
  id: uuidSchema,
  recipe: z.object({ id: uuidSchema, title: z.string() }),
  homeSpace: spaceRefSchema,
  /** Espace ou le demandeur voit la recette (portee du reglage de confiance). */
  sourceSpace: spaceRefSchema,
  targetSpace: spaceRefSchema.extend({ memberCount: z.number().int() }),
  requester: userSummarySchema,
  message: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  /** Confiance actuelle de l'auteur dans sourceSpace ; null si le decideur n'est pas l'auteur. */
  trust: z.boolean().nullable(),
});
export type ShareRequest = z.infer<typeof shareRequestSchema>;

export const shareRequestParamsSchema = z.strictObject({
  spaceId: uuidSchema,
  requestId: uuidSchema,
});

/** `trustMembers` : autoriser les membres de sourceSpace a partager sans demander [D101]. */
export const approveShareRequestBodySchema = z.strictObject({
  trustMembers: z.boolean().optional(),
});

/** Avant de quitter un espace (F-QUITTER, D84). */
export const recipeLeavePreviewSchema = z.object({
  /** Recettes creees dans cet espace : elles y restent (D18). */
  createdHere: z.number().int(),
  /** Recettes de l'espace perso partagees ici : laisser ou retirer, au choix. */
  personalShared: z.array(z.object({ id: uuidSchema, title: z.string() })),
});
export type RecipeLeavePreview = z.infer<typeof recipeLeavePreviewSchema>;

// --- Adaptation [D17, D105, D140] ---

/** Espace ou creer l'adaptation : tout espace ou l'utilisateur peut creer une recette. */
export const adaptRecipeBodySchema = z.strictObject({ targetSpaceId: uuidSchema });
export type AdaptRecipeBody = z.infer<typeof adaptRecipeBodySchema>;

const contentLinkSchema = z.object({
  kind: z.literal("RECIPE"),
  recipeId: uuidSchema,
  /** null si la recette liee est supprimee. */
  title: z.string().nullable(),
  quantity: z.number(),
  unitId: uuidSchema.nullable(),
});

/** Contenu versionne lisible (forme de `RecipeContentView`, recipes/diff.ts). */
export const recipeContentViewSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  yieldQuantity: z.number(),
  yieldUnitId: uuidSchema.nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  restMinutes: z.number().int().nullable(),
  isBase: z.boolean(),
  blocks: z.array(z.union([localBlockSchema, contentLinkSchema])),
});

/** E-COMPARER-ORIGINAL : les trois contenus ; le web calcule les differences. */
export const recipeComparisonSchema = z.object({
  original: z.object({
    id: uuidSchema,
    title: z.string(),
    author: userSummarySchema,
    homeSpace: spaceRefSchema,
    deleted: z.boolean(),
    currentRevision: z.number().int(),
    /** Derniere modification depuis la revision vue ; null si rien n'a change. */
    lastChange: z.object({ at: isoDateTimeSchema, by: userSummarySchema }).nullable(),
  }),
  /** Revision de l'original avec laquelle l'adaptation est alignee. */
  baseRevision: z.number().int(),
  /** Original a `baseRevision`. */
  base: recipeContentViewSchema,
  /** Original actuel ; null s'il est supprime. */
  current: recipeContentViewSchema.nullable(),
  adaptation: recipeContentViewSchema,
  /** "Marquer comme vu" : qui peut modifier l'adaptation. */
  canMarkSeen: z.boolean(),
});
export type RecipeComparison = z.infer<typeof recipeComparisonSchema>;

// --- Suggestions [D04, D140, D166] ---

export const SUGGESTION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "CONVERTED",
  "CANCELLED",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export const SUGGESTION_MESSAGE_MAX = 280;

const {
  globalTagIds: _globalTagIds,
  spaceTagIds: _spaceTagIds,
  ...suggestedShape
} = recipeContentShape;
const suggestionMessageSchema = z.string().trim().max(SUGGESTION_MESSAGE_MAX).optional();

/** Contenu complet propose (sans tags, non versionnes) et revision de depart. */
export const createSuggestionBodySchema = z.strictObject({
  ...suggestedShape,
  revision: z.number().int().min(1),
  message: suggestionMessageSchema,
});
export type CreateSuggestionBody = z.input<typeof createSuggestionBodySchema>;

/** `revision` : revision courante vue par le decideur (verrou optimiste, D163). */
export const acceptSuggestionBodySchema = z.strictObject({ revision: z.number().int().min(1) });
export const rejectSuggestionBodySchema = z.strictObject({ message: suggestionMessageSchema });
export const convertSuggestionBodySchema = adaptRecipeBodySchema;

export const suggestionParamsSchema = recipeParamsSchema.extend({ suggestionId: uuidSchema });

export const suggestionSummarySchema = z.object({
  id: uuidSchema,
  /** homeSpaceId : ouvrir la suggestion depuis "Mes recettes". */
  recipe: z.object({ id: uuidSchema, title: z.string(), homeSpaceId: uuidSchema }),
  proposer: userSummarySchema,
  message: z.string().nullable(),
  status: z.enum(SUGGESTION_STATUSES),
  baseRevision: z.number().int(),
  createdAt: isoDateTimeSchema,
  decidedAt: isoDateTimeSchema.nullable(),
  decidedBy: userSummarySchema.nullable(),
  /** Mot du decideur au refus [D166]. */
  decisionMessage: z.string().nullable(),
  /** Adaptation creee depuis la suggestion refusee. */
  convertedRecipeId: uuidSchema.nullable(),
});
export type SuggestionSummary = z.infer<typeof suggestionSummarySchema>;

/**
 * Partie de la recette changee a la fois par la suggestion et depuis sa revision
 * de depart : un champ (DIFF_FIELDS), `block:<n>` ou `blocks` (structure des blocs).
 */
export const suggestionConflictSchema = z.string();

/** E-SUGGESTION : effet de l'acceptation sur la version actuelle. */
export const suggestionSchema = suggestionSummarySchema.extend({
  currentRevision: z.number().int(),
  proposed: recipeContentViewSchema,
  current: recipeContentViewSchema,
  /** Version actuelle avec les changements de la suggestion (ce qu'accepter enregistre). */
  result: recipeContentViewSchema,
  conflicts: z.array(suggestionConflictSchema),
  can: z.object({ decide: z.boolean(), withdraw: z.boolean(), convert: z.boolean() }),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

// --- Import (C3.8) ---

/** Lien d'une page de recette a importer (http ou https seulement). */
export const importRecipeBodySchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }).max(RECIPE_URL_MAX),
});
export type ImportRecipeBody = z.infer<typeof importRecipeBodySchema>;

/** Recette lue sur une page, a relire dans l'editeur avant tout enregistrement. */
export const importedRecipeSchema = z.object({
  title: z.string().nullable(),
  yieldQuantity: z.number().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  restMinutes: z.number().int().nullable(),
  sourceUrl: z.string().nullable(),
  ingredients: z.array(
    z.object({
      raw: z.string(),
      quantity: z.number().nullable(),
      unitCode: z.string().nullable(),
      name: z.string(),
      note: z.string().nullable(),
      check: z.boolean(),
    })
  ),
  steps: z.array(z.string()),
});
