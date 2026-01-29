import { RequestHandler } from "express";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";

interface SearchTagsQuery {
  search?: string;
  limit?: string;
}

export const searchTags: RequestHandler<unknown, unknown, unknown, SearchTagsQuery> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const search = req.query.search?.trim().toLowerCase() || "";
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

  try {
    assertIsDefine(authenticatedUserId);

    const tags = await prisma.tag.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            recipes: {
              where: {
                recipe: {
                  deletedAt: null,
                  creatorId: authenticatedUserId,
                  communityId: null,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: limit,
    });

    const data = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      recipeCount: tag._count.recipes,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};
