// Recettes d'un espace (C3.2) : creer, lire, modifier, supprimer [D05, D57, D122].
// Visibilite : espace d'origine et espaces de partage actifs [D03].
import type { Recipe, RevisionSource } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { assertComposition, countUsedBy, loadLinks } from "./composition.ts";
import {
  blocksCreate,
  checkTags,
  detailInclude,
  linksOf,
  recipeColumns,
  resolveContent,
  snapshotOf,
  toRecipe,
  type RecipeContent,
  type ShareInfo,
} from "./content.ts";

/** Qui agit, dans quel espace, avec quels droits de module. */
export interface RecipeActor {
  userId: string;
  spaceId: string;
  /** Permission `recipes.moderate` dans cet espace (MOD, OWNER, OWNER du perso). */
  moderate: boolean;
}

/** Recettes visibles dans un espace : origine ou partage actif [D03]. */
export function visibleIn(spaceId: string): Prisma.RecipeWhereInput {
  return {
    deletedAt: null,
    OR: [{ homeSpaceId: spaceId }, { shares: { some: { spaceId, removedAt: null } } }],
  };
}

export interface RightsRow {
  homeSpaceId: string;
  authorId: string;
}

type Db = Context["db"] | Prisma.TransactionClient;

export async function isActiveMember(db: Db, spaceId: string, userId: string): Promise<boolean> {
  const membership = await db.membership.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
    select: { leftAt: true },
  });
  return membership !== null && membership.leftAt === null;
}

/** L'auteur est encore membre de l'espace d'origine ; sinon les moderateurs reprennent [D18]. */
export function authorIsActiveMember(db: Db, recipe: RightsRow): Promise<boolean> {
  return isActiveMember(db, recipe.homeSpaceId, recipe.authorId);
}

/**
 * Modifier : auteur, MOD et OWNER de l'espace d'origine (D57, D122) ; l'auteur
 * le fait aussi depuis un espace de partage.
 * Supprimer et partager directement : auteur ; MOD et OWNER de l'espace d'origine
 * si l'auteur en est parti (D18, D81).
 * Retirer d'un espace de partage : auteur, MOD et OWNER de cet espace (F-REC-9).
 */
export async function rightsOf(
  ctx: Context,
  actor: RecipeActor,
  recipe: RightsRow
): Promise<Recipe["can"]> {
  const atHome = recipe.homeSpaceId === actor.spaceId;
  const isAuthor = recipe.authorId === actor.userId;
  const authorActive = await authorIsActiveMember(ctx.db, recipe);
  if (isAuthor && authorActive) {
    return { edit: true, delete: true, share: true, removeFromSpace: !atHome };
  }
  if (atHome && actor.moderate) {
    return { edit: true, delete: !authorActive, share: !authorActive, removeFromSpace: false };
  }
  return {
    edit: false,
    delete: false,
    share: false,
    removeFromSpace: !atHome && (actor.moderate || isAuthor),
  };
}

/** Original lie [D17] et nombre d'adaptations [F-REC-13]. */
async function adaptationInfo(
  db: Db,
  row: { id: string; adaptedFromId: string | null; adaptedFromRevision: number | null }
): Promise<Pick<Recipe, "adaptedFrom" | "adaptationCount">> {
  const [adaptationCount, original] = await Promise.all([
    db.recipe.count({ where: { adaptedFromId: row.id, deletedAt: null } }),
    row.adaptedFromId
      ? db.recipe.findUnique({
          where: { id: row.adaptedFromId },
          select: {
            id: true,
            title: true,
            currentRevision: true,
            deletedAt: true,
            author: { select: { id: true, username: true } },
            homeSpace: { select: { id: true, name: true } },
          },
        })
      : null,
  ]);
  if (!original) return { adaptedFrom: null, adaptationCount };
  const deleted = original.deletedAt !== null;
  return {
    adaptationCount,
    adaptedFrom: {
      id: original.id,
      title: original.title,
      author: { id: original.author.id, username: original.author.username, avatarUrl: null },
      homeSpace: original.homeSpace,
      deleted,
      changed: !deleted && original.currentRevision > (row.adaptedFromRevision ?? 0),
    },
  };
}

/** Partages actifs ; noms des espaces dont l'utilisateur est membre. */
async function shareInfo(ctx: Context, actor: RecipeActor, recipeId: string): Promise<ShareInfo> {
  const rows = await ctx.db.recipeShare.findMany({
    where: { recipeId, removedAt: null, space: { deletedAt: null } },
    orderBy: { sharedAt: "asc" },
    select: {
      space: {
        select: {
          id: true,
          name: true,
          memberships: { where: { userId: actor.userId, leftAt: null }, select: { id: true } },
        },
      },
    },
  });
  return {
    shareCount: rows.length,
    sharedIn: rows
      .filter((row) => row.space.memberships.length > 0)
      .map((row) => ({ id: row.space.id, name: row.space.name })),
  };
}

export async function findVisible(ctx: Context, actor: RecipeActor, recipeId: string) {
  const row = await ctx.db.recipe.findFirst({
    where: { id: recipeId, ...visibleIn(actor.spaceId) },
    include: detailInclude(actor.spaceId),
  });
  if (!row) throw new AppError("RECIPE_001");
  return row;
}

export async function getRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<Recipe> {
  const row = await findVisible(ctx, actor, recipeId);
  const [can, links, usedBy, shares, adaptation] = await Promise.all([
    rightsOf(ctx, actor, row),
    loadLinks(ctx.db, row.blocks, actor.spaceId),
    countUsedBy(ctx.db, row.id),
    shareInfo(ctx, actor, row.id),
    adaptationInfo(ctx.db, row),
  ]);
  return toRecipe(row, can, links, usedBy, { ...shares, ...adaptation });
}

/** Adaptation [D17] : original, revision de depart, liens de l'original gardes. */
export interface AdaptationSource {
  adaptedFromId: string;
  adaptedFromRevision: number;
  keepLinks: ReadonlySet<string>;
}

export async function createRecipe(
  ctx: Context,
  actor: RecipeActor,
  input: RecipeContent,
  adaptation?: AdaptationSource
): Promise<Recipe> {
  const content = await resolveContent(ctx.db, input, actor.spaceId, adaptation?.keepLinks);
  await assertComposition(ctx.db, null, linksOf(content.blocks));
  const id = await ctx.db.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        ...recipeColumns(content),
        homeSpaceId: actor.spaceId,
        authorId: actor.userId,
        currentRevision: 1,
        adaptedFromId: adaptation?.adaptedFromId ?? null,
        adaptedFromRevision: adaptation?.adaptedFromRevision ?? null,
        blocks: blocksCreate(content.blocks),
        globalTags: { create: content.globalTagIds.map((tagId) => ({ tagId })) },
        spaceTags: {
          create: content.spaceTagIds.map((tagId) => ({ tagId, spaceId: actor.spaceId })),
        },
        revisions: {
          create: {
            number: 1,
            source: "CREATE",
            authorId: actor.userId,
            snapshot: snapshotOf(content),
          },
        },
      },
      select: { id: true },
    });
    return recipe.id;
  });
  return getRecipe(ctx, actor, id);
}

export async function updateRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  input: RecipeContent & { revision: number }
): Promise<Recipe> {
  const current = await findEditable(ctx, actor, recipeId);
  const keepLinks = new Set(current.blocks.flatMap((b) => (b.subRecipeId ? [b.subRecipeId] : [])));
  await writeRevision(ctx, actor, recipeId, input, input.revision, "EDIT", keepLinks);
  return getRecipe(ctx, actor, recipeId);
}

/** Recette visible que l'acteur peut modifier (sinon SPACE_002). */
export async function findEditable(ctx: Context, actor: RecipeActor, recipeId: string) {
  const current = await findVisible(ctx, actor, recipeId);
  if (!(await rightsOf(ctx, actor, current)).edit) throw new AppError("SPACE_002");
  return current;
}

/**
 * Remplace le contenu et ajoute la revision suivante. Verrou optimiste [D163] :
 * `baseRevision` doit encore etre la revision courante, sinon RECIPE_004.
 * `keepLinks` : liens deja presents, gardes meme si leur recette n'est plus visible.
 */
export async function writeRevision(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  input: RecipeContent,
  baseRevision: number,
  source: RevisionSource,
  keepLinks: ReadonlySet<string>
): Promise<void> {
  const content = await resolveContent(ctx.db, input, actor.spaceId, keepLinks);
  await assertComposition(ctx.db, recipeId, linksOf(content.blocks));
  const number = baseRevision + 1;
  await ctx.db.$transaction(async (tx) => {
    const updated = await tx.recipe.updateMany({
      where: { id: recipeId, deletedAt: null, currentRevision: baseRevision },
      data: { ...recipeColumns(content), currentRevision: number },
    });
    if (updated.count === 0) throw new AppError("RECIPE_004");
    await tx.recipeBlock.deleteMany({ where: { recipeId } });
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        blocks: blocksCreate(content.blocks),
        globalTags: {
          deleteMany: {},
          create: content.globalTagIds.map((tagId) => ({ tagId })),
        },
        spaceTags: {
          deleteMany: { spaceId: actor.spaceId },
          create: content.spaceTagIds.map((tagId) => ({ tagId, spaceId: actor.spaceId })),
        },
        revisions: {
          create: { number, source, authorId: actor.userId, snapshot: snapshotOf(content) },
        },
      },
    });
  });
}

/** Suppression masquee : la recette disparait de tous les espaces [F-REC-10]. */
export async function deleteRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<void> {
  const current = await findVisible(ctx, actor, recipeId);
  if (!(await rightsOf(ctx, actor, current)).delete) throw new AppError("SPACE_002");
  await ctx.db.recipe.update({ where: { id: recipeId }, data: { deletedAt: new Date() } });
}

/** Tags d'espace poses sur une recette visible, par tout membre [D19, D27]. */
export async function setSpaceTags(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  tagIds: string[]
): Promise<Recipe> {
  await findVisible(ctx, actor, recipeId);
  await checkTags(ctx.db, tagIds, actor.spaceId, "tagIds");
  await ctx.db.$transaction([
    ctx.db.recipeSpaceTag.deleteMany({ where: { recipeId, spaceId: actor.spaceId } }),
    ctx.db.recipeSpaceTag.createMany({
      data: tagIds.map((tagId) => ({ recipeId, spaceId: actor.spaceId, tagId })),
    }),
  ]);
  return getRecipe(ctx, actor, recipeId);
}
