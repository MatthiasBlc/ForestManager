import prisma from "../util/db";
import createHttpError from "http-errors";

/**
 * Verifie qu'un utilisateur est membre d'une communaute.
 * @returns Le membership (avec role) si l'utilisateur est membre.
 * @throws 403 si l'utilisateur n'est pas membre.
 */
export async function requireMembership(
  userId: string,
  communityId: string,
  errorMessage = "COMMUNITY_001: Not a member of this community"
) {
  const membership = await prisma.userCommunity.findFirst({
    where: {
      userId,
      communityId,
      deletedAt: null,
    },
  });

  if (!membership) {
    throw createHttpError(403, errorMessage);
  }

  return membership;
}

/**
 * Verifie l'acces a une recette (personnelle ou communautaire).
 * - Recette personnelle : seul le createur y accede.
 * - Recette communautaire : l'utilisateur doit etre membre de la communaute.
 * @returns Le membership si recette communautaire, null si recette personnelle.
 */
export async function requireRecipeAccess(
  userId: string,
  recipe: { creatorId: string; communityId: string | null }
) {
  if (recipe.communityId === null) {
    if (recipe.creatorId !== userId) {
      throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
    }
    return null;
  }

  return requireMembership(
    userId,
    recipe.communityId,
    "RECIPE_002: Cannot access this recipe"
  );
}

/**
 * Verifie qu'un utilisateur est le createur d'une recette ET membre de la communaute.
 * Pour les operations de modification (update, delete).
 * - Recette personnelle : seul le createur.
 * - Recette communautaire : createur + membre de la communaute.
 */
export async function requireRecipeOwnership(
  userId: string,
  recipe: { creatorId: string; communityId: string | null }
) {
  if (recipe.creatorId !== userId) {
    throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
  }

  if (recipe.communityId !== null) {
    return requireMembership(
      userId,
      recipe.communityId,
      "RECIPE_002: Cannot access this recipe"
    );
  }

  return null;
}
