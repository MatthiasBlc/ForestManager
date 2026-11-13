// Unites et quantites (logique pure, partagee API et web) : conversion dans une
// dimension, mise a l'echelle, choix de l'unite lisible, format a la francaise
// [D24, D36]. Les unites viennent du referentiel (Unit) ; seules leurs
// proprietes de calcul sont utiles ici.

export const UNIT_DIMENSIONS = ["MASS", "VOLUME", "COUNT", "NONE"] as const;
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number];

export interface UnitDef {
  code: string;
  dimension: UnitDimension;
  /** Valeur de 1 unite dans l'unite de base (g, ml) ; null pour COUNT et NONE. */
  toBase: number | null;
  /** Unite metrique (g, kg, ml, cl, l) : peut etre remplacee par une unite plus lisible. */
  metric: boolean;
}

/** Convertit une quantite d'une unite a l'autre ; null si c'est impossible. */
export function convert(quantity: number, from: UnitDef, to: UnitDef): number | null {
  if (from.code === to.code) return quantity;
  if (from.dimension !== to.dimension || from.toBase === null || to.toBase === null) return null;
  return round((quantity * from.toBase) / to.toBase);
}

/** Quantite pour `target` portions (ou unites de rendement) au lieu de `base`. */
export function scaleQuantity(
  quantity: number | null,
  base: number,
  target: number
): number | null {
  if (base <= 0) throw new Error("yield must be positive");
  if (quantity === null) return null;
  return (quantity * target) / base;
}

/**
 * Unite metrique la plus lisible de la meme dimension : la plus grande qui donne
 * une valeur >= 1 (1500 g -> 1,5 kg ; 0,5 kg -> 500 g). Les unites de cuisine
 * (cuilleres, tasses) et les pieces sont gardees telles quelles.
 */
export function simplify(
  quantity: number,
  unit: UnitDef,
  units: readonly UnitDef[]
): { quantity: number; unit: UnitDef } {
  if (!unit.metric || unit.toBase === null) return { quantity, unit };
  const base = quantity * unit.toBase;
  const candidates = units
    .filter((u) => u.metric && u.dimension === unit.dimension && u.toBase !== null)
    .sort((a, b) => (b.toBase ?? 0) - (a.toBase ?? 0));
  const best = candidates.find((u) => base / (u.toBase ?? 1) >= 1) ?? candidates.at(-1) ?? unit;
  return { quantity: round(base / (best.toBase ?? 1)), unit: best };
}

export interface QuantityLine {
  /** null : sans quantite ("a gout"). */
  quantity: number | null;
  unit: UnitDef;
}

/**
 * Additionne les quantites d'un meme ingredient, comme la liste de courses [D46] :
 * masses et volumes par leur unite de base puis simplifies, pieces converties en
 * grammes quand l'ingredient connait leur poids (`gramsPerUnit`, par code d'unite).
 * Sinon une ligne par unite. Ordre : masse, volume, puis les autres unites
 * dans l'ordre de saisie.
 */
export function addQuantities(
  lines: readonly QuantityLine[],
  units: readonly UnitDef[],
  gramsPerUnit: Readonly<Record<string, number>> = {}
): QuantityLine[] {
  const totals = new Map<"MASS" | "VOLUME", number>();
  const others = new Map<string, QuantityLine>();
  for (const { quantity, unit } of lines) {
    const grams = unit.dimension === "COUNT" ? gramsPerUnit[unit.code] : undefined;
    if (quantity !== null && grams !== undefined) {
      totals.set("MASS", (totals.get("MASS") ?? 0) + quantity * grams);
      continue;
    }
    if (
      quantity !== null &&
      unit.toBase !== null &&
      (unit.dimension === "MASS" || unit.dimension === "VOLUME")
    ) {
      totals.set(unit.dimension, (totals.get(unit.dimension) ?? 0) + quantity * unit.toBase);
      continue;
    }
    const previous = others.get(unit.code)?.quantity ?? null;
    const sum = quantity === null ? previous : (previous ?? 0) + quantity;
    others.set(unit.code, { unit, quantity: sum === null ? null : round(sum) });
  }
  const result: QuantityLine[] = [];
  for (const dimension of ["MASS", "VOLUME"] as const) {
    const total = totals.get(dimension);
    const baseUnit = units.find((u) => u.dimension === dimension && u.toBase === 1);
    if (total === undefined || !baseUnit) continue;
    result.push(simplify(round(total), baseUnit, units));
  }
  return [...result, ...others.values()];
}

/** Arrondi a 1e-6 : evite 0.30000000000000004 dans les conversions. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

const FRACTIONS: readonly [number, string][] = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

const DECIMAL = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/**
 * Quantite a la francaise : virgule decimale, deux decimales au plus, milliers
 * separes. `fractions` : ¼, ⅓, ½, ⅔, ¾ quand la partie decimale s'en approche
 * (quantites de cuisine).
 */
export function formatQuantity(quantity: number, options: { fractions?: boolean } = {}): string {
  if (options.fractions === true && quantity > 0 && quantity < 100) {
    const whole = Math.floor(quantity);
    const rest = quantity - whole;
    const fraction = FRACTIONS.find(([value]) => Math.abs(rest - value) < 0.01);
    if (fraction) return whole > 0 ? `${whole} ${fraction[1]}` : fraction[1];
  }
  return DECIMAL.format(quantity);
}

/**
 * Forme de comparaison d'un nom (ingredient, tag) : minuscules, sans accents,
 * ligatures developpees, espaces reduits. Meme regle cote API (unicite) et web.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}
