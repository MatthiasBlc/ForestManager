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

    const tags = await getAutocompleteTags(authenticatedUserId, communityId, search, limit);

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

    const data = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      scope: tag.scope,
      communityId: tag.communityId,
      recipeCount: countMap.get(tag.id) || 0,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};
