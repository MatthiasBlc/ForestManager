// Contenu d'une recette : verification des references (ingredients, unites,
// tags), ecriture des blocs, instantane de revision [D05, D30] et lecture.
import type { LocalBlockInput, Recipe, RecipeBlock, Tag } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";

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
  blocks: LocalBlockInput[];
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

/**
 * Verifie les references du contenu et remplace les ingredients fusionnes par
 * leur cible [D120]. Renvoie le contenu normalise, pret a ecrire.
 */
export async function resolveContent(
  db: Tx,
  content: RecipeContent,
  spaceId: string
): Promise<RecipeContent> {
  const lines = content.blocks.flatMap((block) => block.ingredients);
  const ingredientIds = [...new Set(lines.map((line) => line.ingredientId))];
  const ingredients = await db.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, mergedIntoId: true },
  });
  if (ingredients.length !== ingredientIds.length) {
    throw invalid("blocks", "Ingredient inconnu");
  }
  const target = new Map(ingredients.map((row) => [row.id, row.mergedIntoId ?? row.id]));

  const unitIds = new Set(lines.flatMap((line) => (line.unitId ? [line.unitId] : [])));
  if (content.yieldUnitId) unitIds.add(content.yieldUnitId);
  const units = await db.unit.count({ where: { id: { in: [...unitIds] } } });
  if (units !== unitIds.size) throw invalid("blocks", "Unite inconnue");

  await checkTags(db, content.globalTagIds, null, "globalTagIds");
  await checkTags(db, content.spaceTagIds, spaceId, "spaceTagIds");

  return {
    ...content,
    blocks: content.blocks.map((block) => ({
      ...block,
      ingredients: block.ingredients.map((line) => ({
        ...line,
        ingredientId: target.get(line.ingredientId) ?? line.ingredientId,
      })),
    })),
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
export function blocksCreate(blocks: LocalBlockInput[]) {
  return {
    create: blocks.map((block, position) => ({
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
    })),
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
    blocks: content.blocks.map((block) => ({
      kind: block.kind,
      title: block.title,
      ingredients: block.ingredients.map((line) => ({ ...line })),
      steps: [...block.steps],
    })),
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
    author: { select: { id: true, username: true } },
    globalTags: { select: { tag: tagInclude } },
    spaceTags: {
      where: { spaceId, tag: { deletedAt: null, mergedIntoId: null } },
      select: { tag: tagInclude },
    },
    blocks: { where: { kind: "RECIPE" as const }, select: { id: true }, take: 1 },
  } satisfies Prisma.RecipeInclude;
}

export function detailInclude(spaceId: string) {
  return {
    ...summaryInclude(spaceId),
    blocks: {
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
    },
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

export function toSummaryBase(row: SummaryRow | DetailRow) {
  return {
    id: row.id,
    homeSpaceId: row.homeSpaceId,
    title: row.title,
    imageUrl: null, // photos en C3.7 [D146]
    yieldQuantity: row.yieldQuantity,
    yieldUnitId: row.yieldUnitId,
    totalMinutes: totalMinutes(row),
    isBase: row.isBase,
    author: { id: row.author.id, username: row.author.username, avatarUrl: null },
    tags: [
      ...row.globalTags.map((link) => toTag(link.tag)).sort(byName),
      ...row.spaceTags.map((link) => toTag(link.tag)).sort(byName),
    ],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSummary(row: SummaryRow) {
  return { ...toSummaryBase(row), isComposed: row.blocks.length > 0 };
}

function toBlock(block: DetailRow["blocks"][number]): RecipeBlock {
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

export function toRecipe(row: DetailRow, can: Recipe["can"]): Recipe {
  return {
    ...toSummaryBase(row),
    description: row.description,
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    restMinutes: row.restMinutes,
    currentRevision: row.currentRevision,
    createdAt: row.createdAt.toISOString(),
    blocks: row.blocks.filter((block) => block.kind === "LOCAL").map(toBlock),
    can,
  };
}
