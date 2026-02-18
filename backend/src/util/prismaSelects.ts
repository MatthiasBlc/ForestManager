/**
 * Objets select/include Prisma reutilisables pour les recettes.
 * Centralise les patterns repetes dans les controllers.
 */

/** Select pour les tags d'une recette (retourne { tag: { id, name, scope, status, communityId } }) */
export const RECIPE_TAGS_SELECT = {
  select: {
    tag: {
      select: {
        id: true,
        name: true,
        scope: true,
        status: true,
        communityId: true,
      },
    },
  },
} as const;

/** Select pour les ingredients proposes dans une proposal, tries par ordre */
export const PROPOSAL_INGREDIENTS_SELECT = {
  select: {
    id: true,
    quantity: true,
    unitId: true,
    order: true,
    ingredient: {
      select: {
        id: true,
        name: true,
        status: true,
      },
    },
  },
  orderBy: {
    order: "asc" as const,
  },
};

/** Select pour les ingredients d'une recette, tries par ordre */
export const RECIPE_INGREDIENTS_SELECT = {
  select: {
    id: true,
    quantity: true,
    order: true,
    ingredient: {
      select: {
        id: true,
        name: true,
      },
    },
  },
  orderBy: {
    order: "asc" as const,
  },
};

/** Select complet pour le detail d'une recette (tags + ingredients + creator) */
export const RECIPE_DETAIL_INCLUDE = {
  tags: RECIPE_TAGS_SELECT,
  ingredients: RECIPE_INGREDIENTS_SELECT,
  creator: {
    select: {
      id: true,
      username: true,
    },
  },
};
