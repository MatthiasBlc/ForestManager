import { RequestHandler } from "express";
import prisma from "../../util/db";

/**
 * GET /api/admin/dashboard/stats
 * Statistiques globales de la plateforme
 */
export const getStats: RequestHandler = async (req, res, next) => {
  try {
    const [
      userCount,
      communityCount,
      recipeCount,
      tagCount,
      ingredientCount,
      featureCount,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.community.count({ where: { deletedAt: null } }),
      prisma.recipe.count({ where: { deletedAt: null } }),
      prisma.tag.count(),
      prisma.ingredient.count(),
      prisma.feature.count(),
    ]);

    // Stats recentes (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      newUsersWeek,
      newCommunitiesWeek,
      newRecipesWeek,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
      }),
      prisma.community.count({
        where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
      }),
      prisma.recipe.count({
        where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
      }),
    ]);

    // Top 5 communautes par membres
    const topCommunities = await prisma.community.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true, recipes: true } },
      },
      orderBy: { members: { _count: "desc" } },
      take: 5,
    });

    res.status(200).json({
      totals: {
        users: userCount,
        communities: communityCount,
        recipes: recipeCount,
        tags: tagCount,
        ingredients: ingredientCount,
        features: featureCount,
      },
      lastWeek: {
        newUsers: newUsersWeek,
        newCommunities: newCommunitiesWeek,
        newRecipes: newRecipesWeek,
      },
      topCommunities: topCommunities.map((c) => ({
        id: c.id,
        name: c.name,
        memberCount: c._count.members,
        recipeCount: c._count.recipes,
      })),
    });
  } catch (error) {
    next(error);
  }
};
