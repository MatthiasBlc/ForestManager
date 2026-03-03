import { RequestHandler } from "express";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination } from "../util/pagination";
import { getAutocompleteTags } from "../services/tagService";

interface SearchTagsQuery {
  search?: string;
  limit?: string;
  communityId?: string;
}

export const searchTags: RequestHandler<unknown, unknown, unknown, SearchTagsQuery> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const search = req.query.search?.trim().toLowerCase() || "";
  const communityId = req.query.communityId?.trim() || null;
  const { limit } = parsePagination(req.query);

  try {
    assertIsDefine(authenticatedUserId);

    // Over-fetch en contexte perso pour compenser les doublons potentiels (meme nom, communityId differents)
    const fetchLimit = communityId ? limit : limit * 3;
    const tags = await getAutocompleteTags(authenticatedUserId, communityId, search, fetchLimit);

    // Enrichir avec recipeCount (recettes perso de l'user ou recettes de la communaute)
    const tagIds = tags.map((t) => t.id);
    const recipeFilter = communityId
      ? { deletedAt: null, communityId }
      : { deletedAt: null, creatorId: authenticatedUserId, communityId: null };

    const counts = await prisma.recipeTag.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: tagIds },
        recipe: recipeFilter,
      },
      _count: { tagId: true },
    });

    const countMap = new Map(counts.map((c) => [c.tagId, c._count.tagId]));

    const enriched = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      scope: tag.scope,
      communityId: tag.communityId,
      recipeCount: countMap.get(tag.id) || 0,
    }));

    // En contexte perso : agreger par nom pour dedupliquer les tags identiques venant de communautes differentes
    let data;
    if (!communityId) {
      const nameMap = new Map<string, typeof enriched[number]>();
      for (const tag of enriched) {
        const existing = nameMap.get(tag.name);
        if (existing) {
          existing.recipeCount += tag.recipeCount;
          // GLOBAL prend le dessus si au moins un tag du groupe est GLOBAL
          if (tag.scope === "GLOBAL") existing.scope = "GLOBAL";
        } else {
          nameMap.set(tag.name, { ...tag, communityId: null });
        }
      }
      data = Array.from(nameMap.values()).slice(0, limit);
    } else {
      data = enriched;
    }

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};
