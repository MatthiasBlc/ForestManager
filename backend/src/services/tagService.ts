import { PrismaClient } from "@prisma/client";
import createHttpError from "http-errors";
import prisma from "../util/db";
import { normalizeNames } from "../util/validation";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const MAX_TAGS_PER_RECIPE = 10;
const MAX_COMMUNITY_TAGS = 100;

interface ResolveTagsResult {
  tagIds: string[];
  pendingTagIds: string[];
}

/**
 * Resout les tags pour une recette selon le scope :
 * - GLOBAL APPROVED existant → reutilise
 * - COMMUNITY (APPROVED ou PENDING) existant dans la communaute → reutilise
 * - Rien trouve + communityId → cree tag COMMUNITY PENDING
 * - Rien trouve + pas de communityId (perso) → cree tag GLOBAL APPROVED
 */
export async function resolveTagsForRecipe(
  tx: TransactionClient,
  tagNames: string[],
  userId: string,
  communityId: string | null
): Promise<ResolveTagsResult> {
  const normalized = normalizeNames(tagNames);

  if (normalized.length > MAX_TAGS_PER_RECIPE) {
    throw createHttpError(400, "TAG_003: Maximum 10 tags per recipe");
  }

  const tagIds: string[] = [];
  const pendingTagIds: string[] = [];

  for (const tagName of normalized) {
    // 1. Chercher un tag GLOBAL APPROVED
    let tag = await tx.tag.findFirst({
      where: { name: tagName, scope: "GLOBAL", status: "APPROVED", communityId: null },
    });

    if (tag) {
      tagIds.push(tag.id);
      continue;
    }

    // 2. Si communityId : chercher tag COMMUNITY (APPROVED ou PENDING) dans cette communaute
    if (communityId) {
      tag = await tx.tag.findFirst({
        where: { name: tagName, scope: "COMMUNITY", communityId },
      });

      if (tag) {
        tagIds.push(tag.id);
        if (tag.status === "PENDING") {
          pendingTagIds.push(tag.id);
        }
        continue;
      }

      // 3. Rien trouve → verifier limite et creer tag COMMUNITY PENDING
      const communityTagCount = await tx.tag.count({
        where: { communityId, scope: "COMMUNITY" },
      });

      if (communityTagCount >= MAX_COMMUNITY_TAGS) {
        throw createHttpError(400, "TAG_003: Community tag limit reached (100)");
      }

      const newTag = await tx.tag.create({
        data: {
          name: tagName,
          scope: "COMMUNITY",
          status: "PENDING",
          communityId,
          createdById: userId,
        },
      });

      tagIds.push(newTag.id);
      pendingTagIds.push(newTag.id);
      continue;
    }

    // 4. Pas de communityId (recette perso) → creer tag GLOBAL APPROVED
    const newTag = await tx.tag.create({
      data: { name: tagName },
    });

    tagIds.push(newTag.id);
  }

  return { tagIds, pendingTagIds };
}

interface AutocompleteTag {
  id: string;
  name: string;
  scope: string;
  communityId: string | null;
}

/**
 * Retourne les tags pour l'autocomplete selon le contexte :
 * - Avec communityId : GLOBAL APPROVED + COMMUNITY APPROVED de cette communaute
 * - Sans communityId (perso) : GLOBAL APPROVED + COMMUNITY APPROVED des communautes de l'user
 *   (filtre par UserCommunityTagPreference.showTags)
 */
export async function getAutocompleteTags(
  userId: string,
  communityId: string | null,
  search: string,
  limit: number
): Promise<AutocompleteTag[]> {
  const searchFilter = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};

  if (communityId) {
    // Tags GLOBAL APPROVED + COMMUNITY APPROVED de cette communaute
    return tx_getTagsForCommunity(communityId, searchFilter, limit);
  }

  // Recettes perso : GLOBAL APPROVED + COMMUNITY APPROVED des communautes de l'user
  return tx_getTagsForPersonal(userId, searchFilter, limit);
}

async function tx_getTagsForCommunity(
  communityId: string,
  searchFilter: object,
  limit: number
): Promise<AutocompleteTag[]> {
  const tags = await prisma.tag.findMany({
    where: {
      ...searchFilter,
      status: "APPROVED",
      OR: [
        { scope: "GLOBAL", communityId: null },
        { scope: "COMMUNITY", communityId },
      ],
    },
    select: { id: true, name: true, scope: true, communityId: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    communityId: t.communityId,
  }));
}

async function tx_getTagsForPersonal(
  userId: string,
  searchFilter: object,
  limit: number
): Promise<AutocompleteTag[]> {
  // Trouver les communautes de l'user ou showTags != false
  const memberships = await prisma.userCommunity.findMany({
    where: { userId, deletedAt: null },
    select: { communityId: true },
  });

  const communityIds = memberships.map((m) => m.communityId);

  // Filtrer par preferences (exclure showTags=false)
  if (communityIds.length > 0) {
    const hiddenPrefs = await prisma.userCommunityTagPreference.findMany({
      where: { userId, communityId: { in: communityIds }, showTags: false },
      select: { communityId: true },
    });
    const hiddenIds = new Set(hiddenPrefs.map((p) => p.communityId));
    const visibleCommunityIds = communityIds.filter((id) => !hiddenIds.has(id));

    const tags = await prisma.tag.findMany({
      where: {
        ...searchFilter,
        status: "APPROVED",
        OR: [
          { scope: "GLOBAL", communityId: null },
          ...(visibleCommunityIds.length > 0
            ? [{ scope: "COMMUNITY" as const, communityId: { in: visibleCommunityIds } }]
            : []),
        ],
      },
      select: { id: true, name: true, scope: true, communityId: true },
      orderBy: { name: "asc" },
      take: limit,
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      communityId: t.communityId,
    }));
  }

  // Pas de communautes → uniquement tags GLOBAL APPROVED
  const tags = await prisma.tag.findMany({
    where: {
      ...searchFilter,
      scope: "GLOBAL",
      status: "APPROVED",
      communityId: null,
    },
    select: { id: true, name: true, scope: true, communityId: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    communityId: t.communityId,
  }));
}

interface SourceTag {
  id: string;
  name: string;
  scope: string;
  communityId: string | null;
}

/**
 * Resout les tags lors d'un fork de recette :
 * - Tag GLOBAL → copie directe (meme tagId)
 * - Tag COMMUNITY : chercher tag APPROVED avec meme nom dans la cible → copie avec tagId cible
 * - Tag COMMUNITY inexistant dans la cible → creer tag PENDING dans la cible
 */
export async function resolveTagsForFork(
  tx: TransactionClient,
  sourceTags: SourceTag[],
  targetCommunityId: string,
  userId: string
): Promise<string[]> {
  const tagIds: string[] = [];

  for (const sourceTag of sourceTags) {
    if (sourceTag.scope === "GLOBAL") {
      // Tag GLOBAL → copie directe
      tagIds.push(sourceTag.id);
      continue;
    }

    // Tag COMMUNITY → chercher equivalent dans la communaute cible
    let targetTag = await tx.tag.findFirst({
      where: {
        name: sourceTag.name,
        scope: "COMMUNITY",
        status: "APPROVED",
        communityId: targetCommunityId,
      },
    });

    if (targetTag) {
      tagIds.push(targetTag.id);
      continue;
    }

    // Chercher aussi un tag PENDING existant pour eviter les doublons
    targetTag = await tx.tag.findFirst({
      where: {
        name: sourceTag.name,
        scope: "COMMUNITY",
        status: "PENDING",
        communityId: targetCommunityId,
      },
    });

    if (targetTag) {
      tagIds.push(targetTag.id);
      continue;
    }

    // Creer tag PENDING dans la communaute cible
    const newTag = await tx.tag.create({
      data: {
        name: sourceTag.name,
        scope: "COMMUNITY",
        status: "PENDING",
        communityId: targetCommunityId,
        createdById: userId,
      },
    });

    tagIds.push(newTag.id);
  }

  return tagIds;
}
