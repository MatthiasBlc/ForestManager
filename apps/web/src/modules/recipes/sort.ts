// Ordre de la liste des recettes [D217] : A a Z par defaut, choix retenu sur
// l'appareil (simple confort), meme tri hors ligne que l'API.
import { normalizeName, RECIPE_SORTS, type RecipeSort } from "@fm/shared";

export const DEFAULT_RECIPE_SORT: RecipeSort = "title";

export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  title: "A à Z",
  "title-desc": "Z à A",
  recent: "Plus récentes",
  oldest: "Plus anciennes",
  time: "Plus rapides",
  "time-desc": "Plus longues",
};

const KEY = "fm:recipeSort";

function isRecipeSort(value: unknown): value is RecipeSort {
  return (RECIPE_SORTS as readonly unknown[]).includes(value);
}

export function readRecipeSort(): RecipeSort {
  try {
    const value = localStorage.getItem(KEY);
    return isRecipeSort(value) ? value : DEFAULT_RECIPE_SORT;
  } catch {
    return DEFAULT_RECIPE_SORT;
  }
}

export function writeRecipeSort(sort: RecipeSort): void {
  try {
    if (sort === DEFAULT_RECIPE_SORT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, sort);
  } catch {
    // Stockage indisponible (navigation privee) : sans consequence.
  }
}

interface Sortable {
  title: string;
  createdAt: string;
  totalMinutes: number | null;
}

/** Tri hors ligne ; une recette sans temps reste a la fin dans les deux sens. */
export function sortRecipes<T extends Sortable>(recipes: readonly T[], sort: RecipeSort): T[] {
  const byTitle = (a: T, b: T) => normalizeName(a.title).localeCompare(normalizeName(b.title));
  const byDate = (a: T, b: T) => a.createdAt.localeCompare(b.createdAt);
  const byTime = (descending: boolean) => (a: T, b: T) => {
    if (a.totalMinutes === null || b.totalMinutes === null) {
      return (a.totalMinutes === null ? 1 : 0) - (b.totalMinutes === null ? 1 : 0);
    }
    return descending ? b.totalMinutes - a.totalMinutes : a.totalMinutes - b.totalMinutes;
  };
  const compare = {
    title: byTitle,
    "title-desc": (a: T, b: T) => byTitle(b, a),
    recent: (a: T, b: T) => byDate(b, a),
    oldest: byDate,
    time: byTime(false),
    "time-desc": byTime(true),
  }[sort];
  return [...recipes].sort(compare);
}
