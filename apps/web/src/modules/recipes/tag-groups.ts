// Tags groupes par famille [D216] : ordre des familles, puis "Autres".
import type { CatalogTag, SpaceSummary, TagCatalog, TagFamily } from "@fm/shared";

export interface TagGroup {
  /** Famille, ou null pour "Autres". */
  family: TagFamily | null;
  tags: CatalogTag[];
}

/** Tags groupes par famille dans l'ordre du catalogue ; "Autres" en dernier. */
export function groupTags(catalog: TagCatalog, tags: readonly CatalogTag[]): TagGroup[] {
  const groups: TagGroup[] = catalog.families.map((family) => ({ family, tags: [] }));
  const others: TagGroup = { family: null, tags: [] };
  for (const tag of tags) {
    const group = groups.find((g) => g.family?.id === tag.familyId) ?? others;
    group.tags.push(tag);
  }
  return [...groups, others].filter((group) => group.tags.length > 0);
}

/**
 * Tags d'une recette dans l'ordre des familles puis des noms (cartes, fiche) ;
 * un tag absent du catalogue passe en dernier.
 */
export function sortByFamily<T extends { id: string }>(
  tags: readonly T[],
  catalog: TagCatalog | undefined
): T[] {
  if (!catalog) return [...tags];
  const rank = new Map<string, number>();
  groupTags(catalog, catalog.tags).forEach((group, g) => {
    group.tags.forEach((tag, t) => rank.set(tag.id, g * 10_000 + t));
  });
  return [...tags].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export function familyLabel(family: TagFamily | null, spaceName: string): string {
  if (!family) return "Autres";
  return family.scope === "SPACE" ? `${family.name} · ${spaceName}` : family.name;
}

/** Espace d'origine dans les filtres de "Mes recettes". */
export function homeLabel(space: SpaceSummary): string {
  return space.kind === "PERSONAL" ? "Perso" : space.name;
}
