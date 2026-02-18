/**
 * Fonctions utilitaires pour formater les reponses API des recettes.
 * Centralise les mappings repetes dans les controllers.
 */

type RawTag = { tag: { id: string; name: string; scope: string; status: string; communityId: string | null } };
type RawIngredient = {
  id: string;
  quantity: number | null;
  order: number;
  ingredient: { id: string; name: string };
};

/** Extrait les tags depuis le format Prisma pivot */
export function formatTags(tags: RawTag[]) {
  return tags.map((rt) => ({
    id: rt.tag.id,
    name: rt.tag.name,
    scope: rt.tag.scope,
    status: rt.tag.status,
    communityId: rt.tag.communityId,
  }));
}

/** Formate les ingredients depuis le format Prisma pivot */
export function formatIngredients(ingredients: RawIngredient[]) {
  return ingredients.map((ri) => ({
    id: ri.id,
    name: ri.ingredient.name,
    ingredientId: ri.ingredient.id,
    quantity: ri.quantity,
    order: ri.order,
  }));
}
