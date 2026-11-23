// Liste de courses (logique pure, partagee API et web) [D228, D231] : parts d'un
// article additionnees, ingredients du planning regroupes, section d'un produit,
// fusion d'ajouts dans la liste. Les unites sont designees par leur id (base).

import type { MealTime } from "../schemas/meal-plan.ts";
import { addQuantities, normalizeName, type QuantityLine, type UnitDef } from "../units/index.ts";

/** Unite du referentiel avec son id : les parts d'un article la designent par son id. */
export interface ShoppingUnit extends UnitDef {
  id: string;
}

/** Part d'un article : une quantite dans une unite (null : sans unite, "3 oeufs"). */
export interface ShoppingPart {
  quantity: number | null;
  unitId: string | null;
}

/** Cle d'un produit dans l'espace : par ingredient, ou par nom normalise pour un texte libre. */
export function productKey(ref: { ingredientId: string | null; label: string | null }): string {
  if (ref.ingredientId !== null) return `ingredient:${ref.ingredientId}`;
  return `label:${normalizeName(ref.label ?? "")}`;
}

/** Code interne des parts sans unite (aucun id d'unite ne peut le prendre). */
const NO_UNIT = "";

/**
 * Additionne des parts comme `addQuantities` [D46] : une seule part quand tout se
 * convertit, sinon les parts jointes ("500 g + 3"). `gramsPerUnit` : poids d'une
 * piece de ce produit, par id d'unite. Les parts sans quantite ("a gout") sont
 * ecartees : un article sans part est un simple libelle.
 */
export function addParts(
  parts: readonly ShoppingPart[],
  units: readonly ShoppingUnit[],
  gramsPerUnit: Readonly<Record<string, number>> = {}
): ShoppingPart[] {
  const defs = units.map((unit) => ({ ...unit, code: unit.id }));
  const byId = new Map(defs.map((unit) => [unit.id, unit]));
  const lines: QuantityLine[] = [];
  for (const { quantity, unitId } of parts) {
    if (quantity === null) continue;
    const unit = (unitId === null ? undefined : byId.get(unitId)) ?? {
      code: unitId ?? NO_UNIT,
      dimension: "NONE" as const,
      toBase: null,
      metric: false,
    };
    lines.push({ quantity, unit });
  }
  return addQuantities(lines, defs, gramsPerUnit).map(({ quantity, unit }) => ({
    quantity,
    unitId: unit.code === NO_UNIT ? null : unit.code,
  }));
}

// --- Depuis le planning ---

/** Repas qui apporte un ingredient : sert au detail "pour : ..." et aux repas deja ajoutes. */
export interface PlanSource {
  mealSlotId: string | null;
  recipeId: string | null;
  recipeTitle: string;
  date: string;
  mealTime: MealTime;
}

/** Ligne d'ingredient d'un repas, deja mise a l'echelle de ses portions. */
export interface PlanIngredientLine {
  ingredientId: string;
  quantity: number | null;
  unitId: string | null;
  optional: boolean;
  source: PlanSource;
}

export interface PlanLine {
  ingredientId: string;
  parts: ShoppingPart[];
  /** Toutes ses lignes sont facultatives : decochee par defaut dans l'apercu. */
  optional: boolean;
  /** Part apportee par chaque repas, dans l'ordre de la periode. */
  sources: { source: PlanSource; parts: ShoppingPart[] }[];
}

function sourceKey(source: PlanSource): string {
  return `${source.mealSlotId ?? ""}|${source.recipeId ?? ""}|${source.date}|${source.mealTime}`;
}

/**
 * Regroupe les ingredients des repas : une ligne par ingredient, dans l'ordre
 * d'apparition, parts additionnees [D228]. `gramsPerUnit` : par ingredient, le
 * poids d'une piece par id d'unite.
 */
export function aggregatePlanLines(
  lines: readonly PlanIngredientLine[],
  units: readonly ShoppingUnit[],
  gramsPerUnit: Readonly<Record<string, Readonly<Record<string, number>>>> = {}
): PlanLine[] {
  type Group = {
    optional: boolean;
    sources: Map<string, { source: PlanSource; parts: ShoppingPart[] }>;
  };
  const groups = new Map<string, Group>();
  for (const { ingredientId, quantity, unitId, optional, source } of lines) {
    const group: Group = groups.get(ingredientId) ?? { optional: true, sources: new Map() };
    group.optional &&= optional;
    const key = sourceKey(source);
    const entry = group.sources.get(key) ?? { source, parts: [] };
    entry.parts.push({ quantity, unitId });
    group.sources.set(key, entry);
    groups.set(ingredientId, group);
  }
  return [...groups].map(([ingredientId, group]) => {
    const weights = gramsPerUnit[ingredientId] ?? {};
    const sources = [...group.sources.values()].map(({ source, parts }) => ({
      source,
      parts: addParts(parts, units, weights),
    }));
    return {
      ingredientId,
      parts: addParts(
        sources.flatMap((entry) => entry.parts),
        units,
        weights
      ),
      optional: group.optional,
      sources,
    };
  });
}

// --- Sections [D231] ---

/**
 * Section d'un produit dans l'espace : sa favorite, puis la section creee depuis
 * son rayon si elle existe encore, sinon null ("Autres").
 */
export function resolveSectionId(
  product: { key: string; aisleId: string | null },
  favorites: ReadonlyMap<string, string>,
  sections: readonly { id: string; aisleId: string | null }[]
): string | null {
  const favorite = favorites.get(product.key);
  if (favorite !== undefined && sections.some((section) => section.id === favorite)) {
    return favorite;
  }
  if (product.aisleId === null) return null;
  return sections.find((section) => section.aisleId === product.aisleId)?.id ?? null;
}

// --- Fusion dans la liste [D231] ---

export interface ListItemState {
  id: string;
  key: string;
  sectionId: string | null;
  checked: boolean;
  parts: ShoppingPart[];
}

export interface Addition<T> {
  key: string;
  /** Section cible, deja resolue (`resolveSectionId`). */
  sectionId: string | null;
  parts: ShoppingPart[];
  /** Ce que l'appelant rattache a la ligne (sources du planning...). */
  payload: T;
}

export interface MergeResult<T> {
  updates: { id: string; parts: ShoppingPart[]; payloads: T[] }[];
  creates: { key: string; sectionId: string | null; parts: ShoppingPart[]; payloads: T[] }[];
}

/**
 * Fusionne des ajouts dans la liste, par produit et par section : un ajout va sur
 * la ligne non cochee du meme produit dans sa section cible, sinon il cree une
 * ligne (un second ajout identique la rejoint). Une ligne cochee, ou deplacee
 * dans une autre section, reste a part. `add` additionne les parts d'un produit.
 */
export function mergeIntoList<T>(
  items: readonly ListItemState[],
  additions: readonly Addition<T>[],
  add: (key: string, parts: ShoppingPart[]) => ShoppingPart[]
): MergeResult<T> {
  const slot = (key: string, sectionId: string | null) => `${key}#${sectionId ?? ""}`;
  const open = new Map<string, ListItemState>();
  for (const item of items) {
    const at = slot(item.key, item.sectionId);
    if (!item.checked && !open.has(at)) open.set(at, item);
  }
  const updates = new Map<string, MergeResult<T>["updates"][number]>();
  const creates = new Map<string, MergeResult<T>["creates"][number]>();
  for (const addition of additions) {
    const at = slot(addition.key, addition.sectionId);
    const existing = open.get(at);
    if (existing) {
      const update = updates.get(existing.id) ?? {
        id: existing.id,
        parts: existing.parts,
        payloads: [],
      };
      update.parts = add(addition.key, [...update.parts, ...addition.parts]);
      update.payloads.push(addition.payload);
      updates.set(existing.id, update);
      continue;
    }
    const pending = creates.get(at);
    if (pending) {
      pending.parts = add(addition.key, [...pending.parts, ...addition.parts]);
      pending.payloads.push(addition.payload);
      continue;
    }
    creates.set(at, {
      key: addition.key,
      sectionId: addition.sectionId,
      parts: add(addition.key, addition.parts),
      payloads: [addition.payload],
    });
  }
  return { updates: [...updates.values()], creates: [...creates.values()] };
}
