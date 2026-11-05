// Recettes composees (logique pure, partagee API et web) [D24] : part utilisee
// d'une sous-recette et regles de composition (pas de boucle, 3 niveaux).
import { convert, type UnitDef } from "../units/index.ts";

/** Niveaux maximum : plat -> sauce -> fond. */
export const MAX_RECIPE_LEVELS = 3;

/**
 * Part de la sous-recette utilisee par un lien : 150 ml d'une sauce qui rend
 * 300 ml -> 0,5. La quantite est convertie si le rendement a change d'unite ;
 * sans unite commune, rapport direct des quantites.
 */
export function linkFactor(
  used: { quantity: number; unit: UnitDef | null },
  sub: { yieldQuantity: number; yieldUnit: UnitDef | null }
): number {
  const quantity =
    used.unit && sub.yieldUnit
      ? (convert(used.quantity, used.unit, sub.yieldUnit) ?? used.quantity)
      : used.quantity;
  return quantity / sub.yieldQuantity;
}

export interface RecipeGraph {
  /** Liens existants : recette -> recettes liees. */
  childrenOf: ReadonlyMap<string, readonly string[]>;
  /** Liens existants : recette -> recettes qui la lient. */
  parentsOf: ReadonlyMap<string, readonly string[]>;
}

export type CompositionError = "CYCLE" | "DEPTH";

/**
 * Verifie que `rootId`, liee desormais a `links`, ne forme pas de boucle et ne
 * depasse pas MAX_RECIPE_LEVELS, en comptant les recettes qui l'utilisent deja.
 */
export function checkComposition(
  rootId: string,
  links: readonly string[],
  graph: RecipeGraph
): CompositionError | null {
  // Hauteur sous un noeud (1 = recette sans lien) ; null si la racine est atteinte.
  const height = (id: string, seen: ReadonlySet<string>): number | null => {
    if (id === rootId || seen.has(id)) return null;
    const next = new Set(seen).add(id);
    let max = 0;
    for (const child of graph.childrenOf.get(id) ?? []) {
      const h = height(child, next);
      if (h === null) return null;
      max = Math.max(max, h);
    }
    return 1 + max;
  };
  let below = 0;
  for (const link of links) {
    const h = height(link, new Set());
    if (h === null) return "CYCLE";
    below = Math.max(below, h);
  }
  const above = (id: string, seen: ReadonlySet<string>): number => {
    const parents = (graph.parentsOf.get(id) ?? []).filter((p) => !seen.has(p));
    const next = new Set(seen).add(id);
    return parents.reduce((max, parent) => Math.max(max, 1 + above(parent, next)), 0);
  };
  return above(rootId, new Set()) + 1 + below > MAX_RECIPE_LEVELS ? "DEPTH" : null;
}
