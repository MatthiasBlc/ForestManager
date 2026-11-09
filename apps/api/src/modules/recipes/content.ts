// Contenu d'une recette : verification des references (ingredients, unites,
// tags), ecriture des blocs, instantane de revision [D05, D30] et lecture.
import type { BlockInput, LinkedBlock, LocalBlock, Recipe, RecipeBlock, Tag } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { imageUrl, toUserSummary } from "../../core/storage/images.ts";
import type { LoadedLink } from "./composition.ts";

export const LOCALE = "fr"; // francais seul en V2.0 [D34]

type Tx = Context["db"] | Prisma.TransactionClient;

/** Contenu valide par le schema partage (creation ou modification). */
export interface RecipeContent {
  title: string;
  description: string | null;
  notes: string | null;
  sourceUrl: string | null;
  yieldQuantity: number;
  yieldUnitId: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  isBase: boolean;
  blocks: BlockInput[];
  globalTagIds: string[];
  spaceTagIds: string[];
}

function invalid(path: string, message: string): AppError {
  return new AppError("VALIDATION_001", [{ location: "body", path, code: "custom", message }]);
}

/** Tags actifs de l'espace (ou globaux si spaceId est null) ; refus si l'un manque. */
export async function checkTags(
  db: Tx,
  ids: string[],
  spaceId: string | null,
  path: string
): Promise<void> {
  if (ids.length === 0) return;
  const found = await db.tag.count({
    where: {
      id: { in: ids },
      scope: spaceId ? "SPACE" : "GLOBAL",
      spaceId,
      deletedAt: null,
      mergedIntoId: null,
    },
  });
  if (found !== ids.length) throw invalid(path, "Tag inconnu");
}

/** Recettes liees par le contenu (blocs RECIPE). */
export function linksOf(blocks: readonly BlockInput[]): string[] {
  return blocks.flatMap((block) => (block.kind === "RECIPE" ? [block.recipeId] : []));
}

/**
 * Verifie les references du contenu et remplace les ingredients fusionnes par
 * leur cible [D120]. Renvoie le contenu normalise, pret a ecrire.
 * Un nouveau lien doit viser une recette visible dans l'espace ; un lien deja
 * present (`keepLinks`) est garde meme si sa recette est supprimee depuis.
 */
export async function resolveContent(
  db: Tx,
  content: RecipeContent,
  spaceId: string,
  keepLinks: ReadonlySet<string> = new Set()
): Promise<RecipeContent> {
  const lines = content.blocks.flatMap((block) =>
    block.kind === "LOCAL" ? block.ingredients : []
  );
  const ingredientIds = [...new Set(lines.map((line) => line.ingredientId))];
  const ingredients = await db.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, mergedIntoId: true },
  });
  if (ingredients.length !== ingredientIds.length) {
    throw invalid("blocks", "Ingredient inconnu");
  }
  const target = new Map(ingredients.map((row) => [row.id, row.mergedIntoId ?? row.id]));

  const linkIds = [...new Set(linksOf(content.blocks))];
  const linked = await db.recipe.findMany({
    where: { id: { in: linkIds } },
    select: {
      id: true,
      homeSpaceId: true,
      deletedAt: true,
      shares: { where: { spaceId, removedAt: null }, select: { id: true } },
    },
  });
  const usable = linked.filter(
    (row) =>
      keepLinks.has(row.id) ||
      (row.deletedAt === null && (row.homeSpaceId === spaceId || row.shares.length > 0))
  );
  if (usable.length !== linkIds.length) throw invalid("blocks", "Recette liee inconnue");

  const unitIds = new Set(
    content.blocks.flatMap((block) =>
      block.kind === "LOCAL"
        ? block.ingredients.flatMap((line) => (line.unitId ? [line.unitId] : []))
        : block.unitId
          ? [block.unitId]
          : []
    )
  );
  if (content.yieldUnitId) unitIds.add(content.yieldUnitId);
  const units = await db.unit.count({ where: { id: { in: [...unitIds] } } });
  if (units !== unitIds.size) throw invalid("blocks", "Unite inconnue");

  await checkTags(db, content.globalTagIds, null, "globalTagIds");
  await checkTags(db, content.spaceTagIds, spaceId, "spaceTagIds");

  return {
    ...content,
    blocks: content.blocks.map((block) =>
      block.kind === "LOCAL"
        ? {
            ...block,
            ingredients: block.ingredients.map((line) => ({
              ...line,
              ingredientId: target.get(line.ingredientId) ?? line.ingredientId,
            })),
          }
        : block
    ),
  };
}

/** Colonnes scalaires de la recette. */
export function recipeColumns(content: RecipeContent) {
  return {
    title: content.title,
    description: content.description,
    notes: content.notes,
    sourceUrl: content.sourceUrl,
    yieldQuantity: content.yieldQuantity,
    yieldUnitId: content.yieldUnitId,
    prepMinutes: content.prepMinutes,
    cookMinutes: content.cookMinutes,
    restMinutes: content.restMinutes,
    isBase: content.isBase,
  };
}

/** Blocs en creation imbriquee (positions 0..n). */
export function blocksCreate(blocks: BlockInput[]) {
  return {
    create: blocks.map((block, position) =>
      block.kind === "RECIPE"
        ? {
            position,
            kind: "RECIPE" as const,
            subRecipeId: block.recipeId,
            subQuantity: block.quantity,
            subUnitId: block.unitId,
          }
        : {
            position,
            kind: "LOCAL" as const,
            title: block.title,
            ingredients: {
              create: block.ingredients.map((line, index) => ({
                position: index,
                ingredientId: line.ingredientId,
                quantity: line.quantity,
                unitId: line.unitId,
                note: line.note,
                optional: line.optional,
              })),
            },
            steps: { create: block.steps.map((text, index) => ({ position: index, text })) },
          }
    ),
  };
}

/** Instantane complet de revision [D30] ; les tags n'en font pas partie [D19]. */
export function snapshotOf(content: RecipeContent): Prisma.InputJsonObject {
  return {
    title: content.title,
    description: content.description,
    notes: content.notes,
    sourceUrl: content.sourceUrl,
    yield: { quantity: content.yieldQuantity, unitId: content.yieldUnitId },
    times: { prep: content.prepMinutes, cook: content.cookMinutes, rest: content.restMinutes },
    isBase: content.isBase,
    blocks: content.blocks.map((block) =>
      block.kind === "RECIPE"
        ? { ...block }
        : {
            kind: block.kind,
            title: block.title,
            ingredients: block.ingredients.map((line) => ({ ...line })),
            steps: [...block.steps],
          }
    ),
  };
}

// --- Lecture ---

export function totalMinutes(row: {
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
}): number | null {
  const times = [row.prepMinutes, row.cookMinutes, row.restMinutes].filter(
    (value): value is number => value !== null
  );
  return times.length === 0 ? null : times.reduce((sum, value) => sum + value, 0);
}

const tagInclude = {
  select: {
    id: true,
    scope: true,
    name: true,
    translations: { where: { locale: LOCALE }, select: { name: true } },
  },
} as const;

/** Relations communes a la liste et au detail ; tags d'espace de cet espace seulement. */
export function summaryInclude(spaceId: string) {
  return {
    author: { select: { id: true, username: true, avatarKey: true } },
    globalTags: { select: { tag: tagInclude } },
    spaceTags: {
      where: { spaceId, tag: { deletedAt: null, mergedIntoId: null } },
      select: { tag: tagInclude },
    },
    blocks: { where: { kind: "RECIPE" as const }, select: { id: true }, take: 1 },
  } satisfies Prisma.RecipeInclude;
}

/** Blocs complets (detail et sous-recettes liees). */
export const blockInclude = {
  orderBy: { position: "asc" as const },
  include: {
    ingredients: {
      orderBy: { position: "asc" as const },
      include: {
        ingredient: {
          select: { translations: { where: { locale: LOCALE } } },
        },
      },
    },
    steps: { orderBy: { position: "asc" as const }, select: { text: true } },
  },
} satisfies Prisma.Recipe$blocksArgs;

export function detailInclude(spaceId: string) {
  return {
    ...summaryInclude(spaceId),
    blocks: blockInclude,
    homeSpace: { select: { id: true, name: true } },
  } satisfies Prisma.RecipeInclude;
}

type SummaryRow = Prisma.RecipeGetPayload<{ include: ReturnType<typeof summaryInclude> }>;
type DetailRow = Prisma.RecipeGetPayload<{ include: ReturnType<typeof detailInclude> }>;

type TagRow = SummaryRow["globalTags"][number]["tag"];

function toTag(tag: TagRow): Tag {
  return { id: tag.id, scope: tag.scope, name: tag.translations[0]?.name ?? tag.name };
}

function byName(a: Tag, b: Tag): number {
  return a.name.localeCompare(b.name, "fr");
}

export function toSummaryBase(ctx: Context, row: SummaryRow | DetailRow) {
  return {
    id: row.id,
    homeSpaceId: row.homeSpaceId,
    title: row.title,
    imageUrl: imageUrl(ctx, row.imageKey),
    yieldQuantity: row.yieldQuantity,
    yieldUnitId: row.yieldUnitId,
    totalMinutes: totalMinutes(row),
    isBase: row.isBase,
    author: toUserSummary(ctx, row.author),
    tags: [
      ...row.globalTags.map((link) => toTag(link.tag)).sort(byName),
      ...row.spaceTags.map((link) => toTag(link.tag)).sort(byName),
    ],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSummary(ctx: Context, row: SummaryRow) {
  return { ...toSummaryBase(ctx, row), isComposed: row.blocks.length > 0 };
}

type BlockRow = DetailRow["blocks"][number];

/** Bloc lie : sous-recette depliee si elle est visible ici (lien vivant). */
function toLinkedBlock(block: BlockRow, links: ReadonlyMap<string, LoadedLink>): LinkedBlock {
  const recipeId = block.subRecipeId ?? "";
  const loaded = links.get(recipeId);
  const status = loaded?.status ?? "DELETED";
  return {
    kind: "RECIPE",
    recipeId,
    quantity: block.subQuantity ?? 0,
    unitId: block.subUnitId,
    status,
    recipe:
      loaded && status === "AVAILABLE"
        ? {
            id: loaded.row.id,
            title: loaded.row.title,
            yieldQuantity: loaded.row.yieldQuantity,
            yieldUnitId: loaded.row.yieldUnitId,
            isBase: loaded.row.isBase,
            blocks: loaded.row.blocks.map((sub) => toBlock(sub, links)),
          }
        : null,
  };
}

function toBlock(block: BlockRow, links: ReadonlyMap<string, LoadedLink>): RecipeBlock {
  if (block.kind === "RECIPE") return toLinkedBlock(block, links);
  return toLocalBlock(block);
}

function toLocalBlock(block: BlockRow): LocalBlock {
  return {
    kind: "LOCAL",
    title: block.title,
    ingredients: block.ingredients.map((line) => {
      const name = line.ingredient.translations[0];
      return {
        ingredientId: line.ingredientId,
        name: name?.name ?? "",
        namePlural: name?.namePlural ?? null,
        quantity: line.quantity,
        unitId: line.unitId,
        note: line.note,
        optional: line.optional,
      };
    }),
    steps: block.steps.map((step) => step.text),
  };
}

/** Partages de la recette vus par l'utilisateur courant. */
export interface ShareInfo {
  shareCount: number;
  sharedIn: Recipe["sharedIn"];
}

/** Partages et adaptation, calcules a part du detail. */
export type RecipeLinksInfo = ShareInfo & Pick<Recipe, "adaptedFrom" | "adaptationCount">;

export function toRecipe(
  ctx: Context,
  row: DetailRow,
  can: Recipe["can"],
  links: ReadonlyMap<string, LoadedLink>,
  usedBy: number,
  extra: RecipeLinksInfo
): Recipe {
  return {
    ...toSummaryBase(ctx, row),
    description: row.description,
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    restMinutes: row.restMinutes,
    currentRevision: row.currentRevision,
    createdAt: row.createdAt.toISOString(),
    blocks: row.blocks.map((block) => toBlock(block, links)),
    usedBy,
    homeSpace: row.homeSpace,
    ...extra,
    hidden: row.hiddenAt ? { reason: row.hiddenReason ?? "" } : null,
    can,
  };
}
