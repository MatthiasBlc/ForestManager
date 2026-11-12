// Dernieres recettes ouvertes, proposees par la palette vide (F-RECHERCHE).
// Confort par navigateur : localStorage, illisible ou plein = liste vide.
const KEY = "fm:recent-recipes";
const MAX = 5;

export interface RecentRecipe {
  id: string;
  title: string;
  spaceId: string;
}

function isRecent(value: unknown): value is RecentRecipe {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.spaceId === "string";
}

export function readRecentRecipes(): RecentRecipe[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Place la recette en tete (une seule fois dans la liste). */
export function pushRecentRecipe(recipe: RecentRecipe): void {
  const next = [recipe, ...readRecentRecipes().filter((r) => r.id !== recipe.id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : rien a retenir.
  }
}
