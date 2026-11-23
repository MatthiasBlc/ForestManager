// Saisie et affichage des quantites de la liste de courses [D228] : la quantite se
// tape dans le meme champ que le produit ("2 citrons", "500 g farine"), avec le
// parseur de l'import texte ; un article a une ou plusieurs parts ("500 g + 3").
import {
  formatQuantity,
  normalizeName,
  parseIngredientLine,
  type ShoppingPartOut,
  type Unit,
} from "@fm/shared";

import { unitLabel } from "../recipes/format.ts";

export interface Entry {
  name: string;
  parts: ShoppingPartOut[];
}

function unitIdOf(code: string | null, units: readonly Unit[]): string | null {
  if (code === null) return null;
  return units.find((unit) => unit.code === code)?.id ?? null;
}

/** "2 citrons" -> citrons, 2 ; "piles AA" -> piles AA, sans quantite ; vide -> null. */
export function parseEntry(text: string, units: readonly Unit[]): Entry | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const parsed = parseIngredientLine(clean);
  // "a gout" n'a rien a acheter en plus : le libelle seul.
  if (parsed.quantity === null || parsed.unitCode === "to-taste") {
    return { name: clean, parts: [] };
  }
  const name = parsed.note ? `${parsed.name}, ${parsed.note}` : parsed.name;
  if (!name || name === clean) return { name: clean, parts: [] };
  return {
    name,
    parts: [{ quantity: parsed.quantity, unitId: unitIdOf(parsed.unitCode, units) }],
  };
}

/** "1 kg", "500 g + 3" -> parts ; "" -> aucune ; illisible -> null. */
export function parseAmount(text: string, units: readonly Unit[]): ShoppingPartOut[] | null {
  const pieces = text
    .split("+")
    .map((piece) => piece.trim())
    .filter(Boolean);
  const parts: ShoppingPartOut[] = [];
  for (const piece of pieces) {
    const parsed = parseIngredientLine(piece);
    // Rien apres la quantite et l'unite : le parseur rend alors le texte entier comme nom.
    if (parsed.quantity === null || parsed.name !== piece) return null;
    const unitId = unitIdOf(parsed.unitCode, units);
    parts.push({ quantity: parsed.quantity, unitId });
  }
  return parts;
}

/** Parts lisibles : "500 g + 3", "1,5 kg" ; aucune part : "". */
export function formatParts(parts: readonly ShoppingPartOut[], units: readonly Unit[]): string {
  return parts
    .map(({ quantity, unitId }) => {
      const unit = units.find((u) => u.id === unitId);
      const shown = formatQuantity(quantity);
      return unit ? `${shown} ${unitLabel(unit, quantity)}` : shown;
    })
    .join(" + ");
}

/** Ingredient du catalogue au meme nom (ou pluriel) que le texte tape. */
export function matchIngredient<T extends { name: string; namePlural: string | null }>(
  name: string,
  ingredients: readonly T[]
): T | undefined {
  const key = normalizeName(name);
  return ingredients.find(
    (ingredient) =>
      normalizeName(ingredient.name) === key ||
      (ingredient.namePlural !== null && normalizeName(ingredient.namePlural) === key)
  );
}

/** Nom affiche d'un article : l'ingredient au pluriel quand il en a un, sinon le libelle. */
export function itemName(item: {
  ingredient: { name: string; namePlural: string | null } | null;
  label: string | null;
}): string {
  if (item.ingredient) return item.ingredient.namePlural ?? item.ingredient.name;
  return item.label ?? "";
}
