// Filtre des recettes par tags [D216] (logique pure, partagee API et web) :
// OU dans une famille, ET entre familles ; un tag sans famille est sa propre famille.

/** Tags choisis groupes par famille, dans l'ordre de selection. */
export function tagFilterGroups(
  tagIds: readonly string[],
  familyOf: (tagId: string) => string | null
): string[][] {
  const groups = new Map<string, string[]>();
  for (const tagId of tagIds) {
    const key = familyOf(tagId) ?? `tag:${tagId}`;
    const group = groups.get(key);
    if (group) group.push(tagId);
    else groups.set(key, [tagId]);
  }
  return [...groups.values()];
}

/** La recette porte au moins un tag choisi de chaque famille. */
export function matchesTagFilter(
  recipeTagIds: readonly string[],
  tagIds: readonly string[],
  familyOf: (tagId: string) => string | null
): boolean {
  const own = new Set(recipeTagIds);
  return tagFilterGroups(tagIds, familyOf).every((group) => group.some((id) => own.has(id)));
}
