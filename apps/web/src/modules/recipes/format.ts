// Affichage des recettes : portions, temps, quantites mises a l'echelle.
import {
  formatQuantity,
  scaleQuantity,
  simplify,
  type RecipeIngredient,
  type Unit,
} from "@fm/shared";

/** "4 pers." ou "300 ml" (rendement dans une unite). */
export function formatYield(quantity: number, unit: Unit | undefined): string {
  return `${formatQuantity(quantity)} ${unit ? unit.abbreviation : "pers."}`;
}

/** "45 min", "1 h", "1 h 15". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest.toString().padStart(2, "0")}`;
}

/** Ligne de carte : "4 pers. · 45 min". */
export function recipeMeta(
  recipe: { yieldQuantity: number; yieldUnitId: string | null; totalMinutes: number | null },
  units: readonly Unit[]
): string {
  const unit = units.find((u) => u.id === recipe.yieldUnitId);
  const parts = [formatYield(recipe.yieldQuantity, unit)];
  if (recipe.totalMinutes !== null) parts.push(formatMinutes(recipe.totalMinutes));
  return parts.join(" · ");
}

/** Quantite affichee d'une ligne pour `servings` portions : "1 kg", "à goût", "2 c. à soupe". */
export function ingredientAmount(
  line: Pick<RecipeIngredient, "quantity" | "unitId">,
  units: readonly Unit[],
  yieldQuantity: number,
  servings: number
): string {
  return scaledAmount(line, units, servings / yieldQuantity);
}

/** Quantite multipliee par `scale` (portions, part d'une sous-recette), lisible. */
export function scaledAmount(
  line: Pick<RecipeIngredient, "quantity" | "unitId">,
  units: readonly Unit[],
  scale: number
): string {
  const unit = units.find((u) => u.id === line.unitId);
  const scaled = scaleQuantity(line.quantity, 1, scale);
  if (scaled === null) return unit ? unit.abbreviation : "";
  if (!unit) return formatQuantity(scaled, { fractions: true });
  if (unit.dimension === "NONE") return unit.abbreviation;
  const readable = simplify(scaled, unit, units);
  const shown = units.find((u) => u.code === readable.unit.code) ?? unit;
  return `${formatQuantity(readable.quantity, { fractions: !shown.metric })} ${shown.abbreviation}`;
}
