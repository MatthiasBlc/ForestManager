// Affichage des recettes : portions, temps, quantites mises a l'echelle, differences lisibles.
import {
  formatQuantity,
  scaleQuantity,
  simplify,
  type ContentBlock,
  type DiffEntry,
  type DiffField,
  type FieldValue,
  type RecipeIngredient,
  type Unit,
} from "@fm/shared";

/**
 * Libelle de l'unite pour cette quantite : "c. a soupe", "g" ; une unite sans
 * abreviation propre (piece, tranche, gousse) passe au pluriel a partir de 2.
 */
export function unitLabel(unit: Unit, quantity: number): string {
  const plain = unit.abbreviation === unit.name;
  return plain && quantity >= 2 && unit.namePlural ? unit.namePlural : unit.abbreviation;
}

/** "4 pers." ou "300 ml" (rendement dans une unite). */
export function formatYield(quantity: number, unit: Unit | undefined): string {
  return `${formatQuantity(quantity)} ${unit ? unitLabel(unit, quantity) : "pers."}`;
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
  const label = unitLabel(shown, readable.quantity);
  return `${formatQuantity(readable.quantity, { fractions: !shown.metric })} ${label}`;
}

/** "Amis", "Amis et TOM", "Amis, TOM et Colloc". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1) ?? ""}`;
}

const FIELD_LABELS: Record<DiffField, string> = {
  title: "Titre",
  description: "Description",
  notes: "Notes",
  source: "Source",
  yield: "Portions",
  prep: "Préparation",
  cook: "Cuisson",
  rest: "Repos",
  base: "Recette de base",
};

const NONE = "—";

function fieldText(value: FieldValue, units: readonly Unit[]): string {
  if (value === null || value === "") return NONE;
  if (typeof value === "object") {
    return formatYield(
      value.quantity,
      units.find((u) => u.id === value.unitId)
    );
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return formatMinutes(value);
  return value;
}

function lineText(line: RecipeIngredient, units: readonly Unit[]): string {
  const amount = scaledAmount(line, units, 1);
  return [amount, line.name, line.note ? `(${line.note})` : ""].filter(Boolean).join(" ");
}

function blockText(block: ContentBlock | null, units: readonly Unit[]): string {
  if (!block) return NONE;
  if (block.kind === "LOCAL") return block.title ?? "Ingrédients et étapes";
  const title = block.title ?? "Recette supprimée";
  return `${scaledAmount(block, units, 1)} ${title}`.trim();
}

/** Ligne lisible d'une difference : libelle, avant, apres. */
export function describeDiff(
  entry: DiffEntry,
  units: readonly Unit[]
): { label: string; before: string; after: string } {
  switch (entry.kind) {
    case "field":
      return {
        label: FIELD_LABELS[entry.field],
        before: fieldText(entry.before, units),
        after: fieldText(entry.after, units),
      };
    case "ingredient":
      return {
        label: entry.blockTitle ? `Ingrédient (${entry.blockTitle})` : "Ingrédient",
        before: entry.before ? lineText(entry.before, units) : NONE,
        after: entry.after ? lineText(entry.after, units) : NONE,
      };
    case "step":
      return {
        label: `Étape ${String(entry.step + 1)}${entry.blockTitle ? ` (${entry.blockTitle})` : ""}`,
        before: entry.before ?? NONE,
        after: entry.after ?? NONE,
      };
    case "block":
      return {
        label:
          entry.after?.kind === "RECIPE" || entry.before?.kind === "RECIPE"
            ? "Recette liée"
            : "Bloc",
        before: blockText(entry.before, units),
        after: blockText(entry.after, units),
      };
  }
}
