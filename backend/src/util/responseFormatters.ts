/**
 * Fonctions utilitaires pour formater les reponses API des recettes.
 * Centralise les mappings repetes dans les controllers.
 */

type RawTag = {
  tag: { id: string; name: string; scope: string; status: string; communityId: string | null };
};
type RawIngredient = {
  id: string;
  quantity: number | null;
  order: number;
  ingredient: { id: string; name: string };
  unit?: { id: string; abbreviation: string } | null;
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
    unitId: ri.unit?.id ?? null,
    unit: ri.unit ?? null,
    order: ri.order,
  }));
}

type RawStep = { id: string; order: number; instruction: string };

/** Formate les etapes depuis le format Prisma */
export function formatSteps(steps: RawStep[]) {
  return steps.map((s) => ({
    id: s.id,
    order: s.order,
    instruction: s.instruction,
  }));
}

/**
 * Transforme une relation avec deletedAt en { ...fields, isDeleted }.
 * Pattern reutilise par mealPlan (slot.recipe), mealIdeas (idea.recipe),
 * mealGenerationParams (rule.recipe).
 */
export function formatDeletedRelation<T extends Record<string, unknown>>(
  relation: (T & { deletedAt: Date | null }) | null,
  fields: (keyof T)[]
): Record<string, unknown> | null {
  if (!relation) return null;
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    result[key as string] = relation[key];
  }
  result.isDeleted = relation.deletedAt !== null;
  return result;
}
