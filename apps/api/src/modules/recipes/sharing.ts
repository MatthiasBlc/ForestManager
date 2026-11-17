// Partage des recettes (C3.5) : partage par reference [D03], sous-recettes du
// meme auteur partagees avec le plat [D26], demandes et confiance de l'auteur
// [D81, D101], retrait d'un espace (F-REC-9), apercu du depart [D84] et crochets
// du cycle de vie : depart d'un membre, purge de l'espace d'origine [D83, D165].
import {
  MAX_RECIPE_LEVELS,
  type RecipeLeavePreview,
  type RecipeSharing,
  type ShareRequest,
  type ShareRequestBody,
  type ShareStatus,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { recipeShared, recipesAdded, shareDecided, shareRequested } from "./events.ts";
import type { MemberLeftReason, PendingCounts } from "../../core/modules/hooks.ts";
import { canModerate } from "./permissions.ts";
import {
  authorIsActiveMember,
  findVisible,
  isActiveMember,
  rightsOf,
  type RecipeActor,
  type RightsRow,
} from "./service.ts";

type Tx = Prisma.TransactionClient;
type Db = Context["db"] | Tx;

interface ShareableRow extends RightsRow {
  id: string;
}

const activeShare = (spaceId: string) => ({ spaceId, removedAt: null });

/** Espaces actifs (non supprimes) de l'utilisateur. */
async function mySpaceIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: { userId, leftAt: null, space: { deletedAt: null } },
    select: { spaceId: true },
  });
  return rows.map((row) => row.spaceId);
}

async function isVisibleIn(db: Db, recipe: ShareableRow, spaceId: string): Promise<boolean> {
  if (recipe.homeSpaceId === spaceId) return true;
  return (
    (await db.recipeShare.count({ where: { recipeId: recipe.id, ...activeShare(spaceId) } })) > 0
  );
}

/**
 * Qui tranche pour cette recette [D81, D18] : l'auteur s'il est encore membre de
 * l'espace d'origine, sinon les MOD et OWNER de cet espace.
 */
export async function decision(db: Db, recipe: RightsRow, userId: string) {
  const authorActive = await authorIsActiveMember(db, recipe);
  if (authorActive) return { decides: recipe.authorId === userId, asAuthor: true };
  const membership = await db.membership.findUnique({
    where: { spaceId_userId: { spaceId: recipe.homeSpaceId, userId } },
    select: { role: true, leftAt: true, space: { select: { kind: true } } },
  });
  const decides =
    membership !== null &&
    membership.leftAt === null &&
    canModerate(membership.space.kind, membership.role);
  return { decides, asAuthor: false };
}

/** Sous-recettes (non supprimees) liees, niveau par niveau, dans l'ordre des blocs. */
async function subRecipesOf(db: Db, recipeId: string) {
  const found: { id: string; title: string; authorId: string }[] = [];
  const seen = new Set([recipeId]);
  let frontier = [recipeId];
  for (let level = 1; level < MAX_RECIPE_LEVELS && frontier.length > 0; level += 1) {
    const blocks = await db.recipeBlock.findMany({
      where: { recipeId: { in: frontier }, kind: "RECIPE" },
      orderBy: { position: "asc" },
      select: {
        recipeId: true,
        subRecipe: { select: { id: true, title: true, authorId: true, deletedAt: true } },
      },
    });
    const next: string[] = [];
    for (const parent of frontier) {
      for (const block of blocks) {
        const sub = block.subRecipe;
        if (block.recipeId !== parent || !sub || sub.deletedAt || seen.has(sub.id)) continue;
        seen.add(sub.id);
        found.push({ id: sub.id, title: sub.title, authorId: sub.authorId });
        next.push(sub.id);
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * Partage `recipe` dans `spaceId` avec ses sous-recettes du meme auteur [D26] ;
 * les demandes en attente pour cet espace sont closes comme acceptees.
 */
async function shareInto(
  tx: Tx,
  recipe: ShareableRow,
  spaceId: string,
  by: { sharedById: string; approvedById: string | null }
): Promise<void> {
  const now = new Date();
  const upsert = (recipeId: string, viaRecipeId: string | null) =>
    tx.recipeShare.upsert({
      where: { recipeId_spaceId: { recipeId, spaceId } },
      create: { recipeId, spaceId, viaRecipeId, ...by },
      update: { sharedAt: now, viaRecipeId, removedAt: null, removedById: null, ...by },
    });
  await upsert(recipe.id, null);
  for (const sub of await subRecipesOf(tx, recipe.id)) {
    if (sub.authorId !== recipe.authorId) continue;
    const row = await tx.recipe.findUniqueOrThrow({
      where: { id: sub.id },
      select: { id: true, homeSpaceId: true, authorId: true },
    });
    if (!(await isVisibleIn(tx, row, spaceId))) await upsert(sub.id, recipe.id);
  }
  await tx.recipeShareRequest.updateMany({
    where: { recipeId: recipe.id, targetSpaceId: spaceId, status: "PENDING" },
    data: { status: "APPROVED", decidedById: by.approvedById ?? by.sharedById, decidedAt: now },
  });
}

/**
 * Retire `recipeId` de `spaceId`, ainsi que les sous-recettes partagees avec elle
 * qu'aucune autre recette visible dans l'espace n'utilise [12-Permissions, D26].
 */
/** Retire la recette (et les sous-recettes emportees) d'un espace ; `userId` null = moderation. */
export async function unshareFrom(
  tx: Tx,
  recipeId: string,
  spaceId: string,
  userId: string | null
): Promise<void> {
  const removed = { removedAt: new Date(), removedById: userId };
  await tx.recipeShare.updateMany({ where: { recipeId, ...activeShare(spaceId) }, data: removed });
  const carried = await tx.recipeShare.findMany({
    where: { viaRecipeId: recipeId, ...activeShare(spaceId) },
    select: { id: true, recipeId: true },
  });
  for (const share of carried) {
    const users = await tx.recipe.count({
      where: {
        id: { notIn: [recipeId, share.recipeId] },
        deletedAt: null,
        OR: [{ homeSpaceId: spaceId }, { shares: { some: activeShare(spaceId) } }],
        blocks: { some: { subRecipeId: share.recipeId } },
      },
    });
    if (users === 0) await tx.recipeShare.update({ where: { id: share.id }, data: removed });
  }
}

// --- Lecture et partage direct (F-PARTAGER) ---

export async function getSharing(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<RecipeSharing> {
  const recipe = await findVisible(ctx, actor, recipeId);
  const spaceIds = (await mySpaceIds(ctx.db, actor.userId)).filter(
    (id) => id !== recipe.homeSpaceId
  );
  const [shares, pending, withIt, { decides }] = await Promise.all([
    ctx.db.recipeShare.findMany({
      where: { recipeId, removedAt: null, spaceId: { in: spaceIds } },
      select: { spaceId: true },
    }),
    ctx.db.recipeShareRequest.findMany({
      where: { recipeId, status: "PENDING", targetSpaceId: { in: spaceIds } },
      select: { targetSpaceId: true },
    }),
    subRecipesOf(ctx.db, recipeId),
    decision(ctx.db, recipe, actor.userId),
  ]);
  const status = new Map<string, ShareStatus>();
  for (const row of pending) status.set(row.targetSpaceId, "PENDING");
  for (const row of shares) status.set(row.spaceId, "SHARED");
  return {
    homeSpace: recipe.homeSpace,
    canShare: decides,
    spaces: spaceIds.flatMap((spaceId) => {
      const value = status.get(spaceId);
      return value ? [{ spaceId, status: value }] : [];
    }),
    withIt: withIt.map((sub) => ({
      id: sub.id,
      title: sub.title,
      included: sub.authorId === recipe.authorId,
    })),
  };
}

/**
 * Cases cochees de F-PARTAGER [D65] : partage dans `spaceIds`, retire des autres
 * espaces de l'utilisateur. Les espaces dont il n'est pas membre ne bougent pas.
 */
export async function setShares(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  spaceIds: string[]
): Promise<RecipeSharing> {
  const recipe = await findVisible(ctx, actor, recipeId);
  if (!(await decision(ctx.db, recipe, actor.userId)).decides) throw new AppError("SPACE_002");
  const wanted = new Set(spaceIds);
  if (wanted.has(recipe.homeSpaceId)) throw new AppError("RECIPE_009");
  const mine = new Set(await mySpaceIds(ctx.db, actor.userId));
  if ([...wanted].some((id) => !mine.has(id))) throw new AppError("SPACE_001");

  const added = await ctx.db.$transaction(async (tx) => {
    const into: string[] = [];
    for (const spaceId of mine) {
      if (spaceId === recipe.homeSpaceId) continue;
      const visible = await isVisibleIn(tx, recipe, spaceId);
      if (wanted.has(spaceId) && !visible) {
        await shareInto(tx, recipe, spaceId, {
          sharedById: actor.userId,
          approvedById: null,
        });
        into.push(spaceId);
      } else if (!wanted.has(spaceId) && visible) {
        await unshareFrom(tx, recipe.id, spaceId, actor.userId);
      }
    }
    return into;
  });
  for (const spaceId of added) await recipeShared(ctx, recipe, spaceId, actor.userId);
  return getSharing(ctx, actor, recipeId);
}

// --- "Depuis mes recettes" : ajout en lot depuis l'espace cible [D203, D208] ---

/**
 * Recettes choisies, dans l'ordre de la selection : de l'acteur, ni supprimees ni
 * masquees, nees dans un espace dont il est encore membre (il tranche lui-meme,
 * D81). Une seule hors de ces regles refuse tout (RECIPE_001).
 */
async function ownRecipes(db: Db, userId: string, recipeIds: string[]) {
  const rows = await db.recipe.findMany({
    where: {
      id: { in: recipeIds },
      authorId: userId,
      deletedAt: null,
      hiddenAt: null,
      homeSpace: {
        deletedAt: null,
        memberships: { some: { userId, leftAt: null } },
      },
    },
    select: { id: true, title: true, homeSpaceId: true, authorId: true },
  });
  if (rows.length !== recipeIds.length) throw new AppError("RECIPE_001");
  const byId = new Map(rows.map((row) => [row.id, row]));
  return recipeIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/** Sous-recettes qui arrivent avec la selection (ni deja visibles, ni deja choisies). */
export async function previewAddMine(
  ctx: Context,
  actor: RecipeActor,
  recipeIds: string[]
): Promise<{ withIt: RecipeSharing["withIt"] }> {
  const recipes = await ownRecipes(ctx.db, actor.userId, recipeIds);
  const seen = new Set(recipeIds);
  const withIt: RecipeSharing["withIt"] = [];
  for (const recipe of recipes) {
    for (const sub of await subRecipesOf(ctx.db, recipe.id)) {
      if (seen.has(sub.id)) continue;
      seen.add(sub.id);
      const row = await ctx.db.recipe.findUniqueOrThrow({
        where: { id: sub.id },
        select: { id: true, homeSpaceId: true, authorId: true },
      });
      if (await isVisibleIn(ctx.db, row, actor.spaceId)) continue;
      withIt.push({ id: sub.id, title: sub.title, included: sub.authorId === recipe.authorId });
    }
  }
  return { withIt };
}

/** Partage les recettes choisies dans l'espace courant, tout ou rien ; renvoie le nombre ajoute. */
export async function addMine(
  ctx: Context,
  actor: RecipeActor,
  recipeIds: string[]
): Promise<number> {
  const added = await ctx.db.$transaction(async (tx) => {
    const into: { id: string; title: string }[] = [];
    for (const recipe of await ownRecipes(tx, actor.userId, recipeIds)) {
      if (await isVisibleIn(tx, recipe, actor.spaceId)) continue;
      await shareInto(tx, recipe, actor.spaceId, { sharedById: actor.userId, approvedById: null });
      into.push(recipe);
    }
    return into;
  });
  const [single] = added;
  if (added.length === 1 && single) {
    await recipeShared(ctx, single, actor.spaceId, actor.userId);
  } else if (added.length > 1) {
    await recipesAdded(ctx, added, actor.spaceId, actor.userId);
  }
  return added.length;
}

/** Retirer la recette de l'espace courant, ou elle est partagee (F-REC-9). */
export async function removeFromSpace(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<void> {
  const recipe = await findVisible(ctx, actor, recipeId);
  if (!(await rightsOf(ctx, actor, recipe)).removeFromSpace) throw new AppError("SPACE_002");
  await ctx.db.$transaction((tx) => unshareFrom(tx, recipeId, actor.spaceId, actor.userId));
}

// --- Demandes de partage [D81, D101] ---

/**
 * Demander a partager une recette vue dans l'espace courant vers un autre de ses
 * espaces. Partage immediat si l'acteur tranche lui-meme, ou si l'auteur fait
 * confiance aux membres de l'espace courant.
 */
export async function requestShare(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  body: ShareRequestBody
): Promise<{ status: ShareStatus; created: boolean }> {
  const recipe = await findVisible(ctx, actor, recipeId);
  const target = body.targetSpaceId;
  if (!(await mySpaceIds(ctx.db, actor.userId)).includes(target)) throw new AppError("SPACE_001");
  if (await isVisibleIn(ctx.db, recipe, target)) throw new AppError("RECIPE_009");

  const { decides, asAuthor } = await decision(ctx.db, recipe, actor.userId);
  const trusted =
    asAuthor &&
    (await ctx.db.membership.count({
      where: {
        spaceId: actor.spaceId,
        userId: recipe.authorId,
        leftAt: null,
        allowMembersToShare: true,
      },
    })) > 0;
  if (decides || trusted) {
    await ctx.db.$transaction((tx) =>
      shareInto(tx, recipe, target, {
        sharedById: actor.userId,
        approvedById: decides ? actor.userId : null,
      })
    );
    await recipeShared(ctx, recipe, target, actor.userId);
    return { status: "SHARED", created: true };
  }

  const pending = { recipeId, targetSpaceId: target, status: "PENDING" as const };
  if ((await ctx.db.recipeShareRequest.count({ where: pending })) > 0) {
    return { status: "PENDING", created: false };
  }
  try {
    await ctx.db.recipeShareRequest.create({
      data: {
        ...pending,
        sourceSpaceId: actor.spaceId,
        requesterId: actor.userId,
        message: body.message || null,
      },
    });
  } catch (error) {
    // Demande concurrente : l'index partiel n'en garde qu'une.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "PENDING", created: false };
    }
    throw error;
  }
  await shareRequested(ctx, recipe, target, actor.userId);
  return { status: "PENDING", created: true };
}

const requestSelect = {
  id: true,
  message: true,
  createdAt: true,
  sourceSpaceId: true,
  recipe: {
    select: {
      id: true,
      title: true,
      authorId: true,
      homeSpaceId: true,
      homeSpace: { select: { id: true, name: true } },
    },
  },
  sourceSpace: { select: { id: true, name: true } },
  targetSpace: {
    select: {
      id: true,
      name: true,
      _count: { select: { memberships: { where: { leftAt: null } } } },
    },
  },
  requester: { select: { id: true, username: true } },
} satisfies Prisma.RecipeShareRequestSelect;

/**
 * Demandes que l'utilisateur tranche. Espace perso : toutes celles de ses
 * recettes ; groupe : celles des recettes nees dans cet espace.
 */
export async function listShareRequests(
  ctx: Context,
  actor: RecipeActor,
  personal: boolean
): Promise<ShareRequest[]> {
  const rows = await ctx.db.recipeShareRequest.findMany({
    where: {
      status: "PENDING",
      targetSpace: { deletedAt: null },
      recipe: {
        deletedAt: null,
        ...(personal ? { authorId: actor.userId } : { homeSpaceId: actor.spaceId }),
      },
    },
    orderBy: { createdAt: "asc" },
    select: requestSelect,
  });
  const result: ShareRequest[] = [];
  for (const row of rows) {
    const { decides, asAuthor } = await decision(ctx.db, row.recipe, actor.userId);
    if (!decides) continue;
    const trust = asAuthor
      ? await ctx.db.membership.findUnique({
          where: { spaceId_userId: { spaceId: row.sourceSpaceId, userId: actor.userId } },
          select: { allowMembersToShare: true, leftAt: true },
        })
      : null;
    result.push({
      id: row.id,
      recipe: { id: row.recipe.id, title: row.recipe.title },
      homeSpace: row.recipe.homeSpace,
      sourceSpace: row.sourceSpace,
      targetSpace: {
        id: row.targetSpace.id,
        name: row.targetSpace.name,
        memberCount: row.targetSpace._count.memberships,
      },
      requester: { id: row.requester.id, username: row.requester.username, avatarUrl: null },
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      trust: trust && !trust.leftAt ? trust.allowMembersToShare : null,
    });
  }
  return result;
}

/**
 * Accepter ou refuser une demande. Une demande inconnue, deja traitee ou que
 * l'utilisateur ne tranche pas donne RECIPE_010 (rien n'est revele).
 */
export async function decideShareRequest(
  ctx: Context,
  userId: string,
  requestId: string,
  choice: { approve: boolean; trustMembers?: boolean | undefined }
): Promise<void> {
  const request = await ctx.db.recipeShareRequest.findFirst({
    where: { id: requestId, status: "PENDING", recipe: { deletedAt: null } },
    select: {
      id: true,
      recipeId: true,
      sourceSpaceId: true,
      targetSpaceId: true,
      requesterId: true,
      targetSpace: { select: { deletedAt: true } },
      recipe: { select: { id: true, title: true, authorId: true, homeSpaceId: true } },
    },
  });
  if (!request) throw new AppError("RECIPE_010");
  const { decides, asAuthor } = await decision(ctx.db, request.recipe, userId);
  if (!decides) throw new AppError("RECIPE_010");

  const close = (status: "APPROVED" | "REJECTED" | "CANCELLED", tx: Db = ctx.db) =>
    tx.recipeShareRequest.update({
      where: { id: request.id },
      data: { status, decidedById: userId, decidedAt: new Date() },
    });

  if (!choice.approve) {
    await close("REJECTED");
    await shareDecided(ctx, request, request.recipe, false, userId);
    return;
  }
  const stillThere =
    !request.targetSpace.deletedAt &&
    (await isActiveMember(ctx.db, request.targetSpaceId, request.requesterId));
  if (!stillThere) {
    await close("CANCELLED");
    throw new AppError("RECIPE_010");
  }
  const shared = await ctx.db.$transaction(async (tx) => {
    const visible = await isVisibleIn(tx, request.recipe, request.targetSpaceId);
    if (!visible) {
      await shareInto(tx, request.recipe, request.targetSpaceId, {
        sharedById: request.requesterId,
        approvedById: userId,
      });
    }
    await close("APPROVED", tx);
    if (choice.trustMembers !== undefined && asAuthor) {
      await tx.membership.updateMany({
        where: { spaceId: request.sourceSpaceId, userId, leftAt: null },
        data: { allowMembersToShare: choice.trustMembers },
      });
    }
    return !visible;
  });
  await shareDecided(ctx, request, request.recipe, true, userId);
  if (shared) {
    await recipeShared(ctx, request.recipe, request.targetSpaceId, request.requesterId);
  }
}

// --- Depart et "Mes recettes" [D82, D84] ---

export async function leavePreview(ctx: Context, actor: RecipeActor): Promise<RecipeLeavePreview> {
  const [createdHere, personalShared] = await Promise.all([
    ctx.db.recipe.count({
      where: { homeSpaceId: actor.spaceId, authorId: actor.userId, deletedAt: null },
    }),
    ctx.db.recipe.findMany({
      where: {
        authorId: actor.userId,
        deletedAt: null,
        homeSpace: { personalUserId: actor.userId },
        shares: { some: activeShare(actor.spaceId) },
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  return { createdHere, personalShared };
}

// --- Crochets du cycle de vie ---

/**
 * Depart d'un membre : ses demandes et suggestions liees a cet espace tombent et sa confiance
 * dans cet espace est oubliee. Ses recettes et ses partages restent [D18, D84]. Renvoie
 * les suggestions en attente sur ses recettes, que les moderateurs reprennent (P08).
 */
export async function onMemberLeft(
  tx: Tx,
  event: { spaceId: string; userId: string; reason: MemberLeftReason }
): Promise<PendingCounts> {
  const { spaceId, userId } = event;
  await tx.recipeShareRequest.updateMany({
    where: {
      requesterId: userId,
      status: "PENDING",
      OR: [{ targetSpaceId: spaceId }, { sourceSpaceId: spaceId }],
    },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  // Ses suggestions faites dans cet espace tombent (12-Permissions, membre exclu).
  await tx.recipeSuggestion.updateMany({
    where: { proposerId: userId, spaceId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  await tx.membership.updateMany({
    where: { spaceId, userId },
    data: { allowMembersToShare: false },
  });
  const suggestions = await tx.recipeSuggestion.count({
    where: { spaceId, status: "PENDING", recipe: { authorId: userId, deletedAt: null } },
  });
  return { "recipes.suggestions": suggestions };
}

/**
 * Purge d'un espace [D83, D165]. Une recette nee ici qui est partagee ailleurs,
 * ou liee par une recette gardee, part dans l'espace perso de son auteur ; sans
 * auteur, dans son plus ancien espace de partage (ses moderateurs la gerent).
 * Les autres recettes de l'espace sont effacees.
 */
export async function onSpaceDeleted(tx: Tx, spaceId: string): Promise<void> {
  await tx.recipeShareRequest.deleteMany({
    where: { OR: [{ targetSpaceId: spaceId }, { sourceSpaceId: spaceId }] },
  });
  await tx.recipeShare.deleteMany({ where: { spaceId } });

  const recipes = await tx.recipe.findMany({
    where: { homeSpaceId: spaceId },
    select: {
      id: true,
      deletedAt: true,
      author: {
        select: { deletedAt: true, personalSpace: { select: { id: true, deletedAt: true } } },
      },
      shares: {
        where: { removedAt: null },
        orderBy: { sharedAt: "asc" },
        select: { spaceId: true },
      },
    },
  });
  if (recipes.length === 0) return;
  const ids = recipes.map((recipe) => recipe.id);
  const links = await tx.recipeBlock.findMany({
    where: { subRecipeId: { in: ids } },
    select: { subRecipeId: true, recipe: { select: { id: true, homeSpaceId: true } } },
  });

  // Nouvelle origine de chaque recette gardee ; une recette liee par une recette
  // gardee est gardee aussi (le bloc lie ne peut pas perdre sa cible).
  const newHome = new Map<string, string>();
  const homeOf = (recipe: (typeof recipes)[number]): string | null => {
    const personal = recipe.author.personalSpace;
    if (!recipe.author.deletedAt && personal && !personal.deletedAt) return personal.id;
    return recipe.shares[0]?.spaceId ?? null;
  };
  for (const recipe of recipes) {
    if (recipe.shares.length > 0 && !recipe.deletedAt) {
      const home = homeOf(recipe);
      if (home) newHome.set(recipe.id, home);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of recipes) {
      if (newHome.has(recipe.id)) continue;
      const linker = links.find(
        (link) =>
          link.subRecipeId === recipe.id &&
          (link.recipe.homeSpaceId !== spaceId || newHome.has(link.recipe.id))
      );
      if (!linker) continue;
      const fallback =
        linker.recipe.homeSpaceId !== spaceId
          ? linker.recipe.homeSpaceId
          : (newHome.get(linker.recipe.id) ?? null);
      const home = homeOf(recipe) ?? fallback;
      if (!home) continue;
      newHome.set(recipe.id, home);
      changed = true;
    }
  }

  for (const [recipeId, home] of newHome) {
    const recipe = recipes.find((row) => row.id === recipeId);
    // Gardee seulement pour un lien, sans partage ni auteur : invisible dans son nouvel espace.
    const hidden = recipe && recipe.shares.length === 0 && home !== homeOf(recipe);
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        homeSpaceId: home,
        ...(hidden && !recipe.deletedAt ? { deletedAt: new Date() } : {}),
      },
    });
    await tx.recipeShare.deleteMany({ where: { recipeId, spaceId: home } });
  }

  const purged = ids.filter((id) => !newHome.has(id));
  // Blocs d'abord : un bloc lie ne peut pas perdre sa cible (CHECK du bloc lie).
  await tx.recipeBlock.deleteMany({ where: { recipeId: { in: purged } } });
  await tx.recipe.deleteMany({ where: { id: { in: purged } } });
}
