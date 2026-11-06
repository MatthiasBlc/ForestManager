// Mode cuisine (F-REC-12) : la recette mise a plat. Les etapes des sous-recettes
// sont deroulees dans l'ordre des blocs, a l'echelle a travers les niveaux (D24).
import { linkFactor, normalizeName, type Recipe, type RecipeBlock, type Unit } from "@fm/shared";

import { scaledAmount } from "./format.ts";

export interface CookLine {
  /** Cle stable d'une ligne (bloc puis position) : sert au cochage. */
  key: string;
  amount: string;
  name: string;
  note: string | null;
}

export interface CookBlock {
  title: string;
  /** Sous-recette (lien vivant) ou bloc titre de la recette. */
  linked: boolean;
  /** Quantite de sous-recette utilisee ("150 ml"), null pour un bloc local. */
  amount: string | null;
}

export interface CookStep {
  text: string;
  /** Null pour le bloc unique sans titre d'une recette simple. */
  block: CookBlock | null;
  /** Ingredients du bloc cites dans le texte de l'etape. */
  ingredients: CookLine[];
}

export interface CookGroup extends CookBlock {
  ingredients: CookLine[];
}

type LocalBlock = Extract<RecipeBlock, { kind: "LOCAL" }>;

interface FlatBlock {
  block: LocalBlock;
  key: string;
  scale: number;
  head: CookBlock | null;
  /** Les blocs d'une meme sous-recette partagent son groupe. */
  group: string;
}

/** Blocs locaux dans l'ordre de lecture, avec leur echelle et leur en-tete. */
function flatten(recipe: Recipe, units: readonly Unit[], scale: number): FlatBlock[] {
  const unitOf = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const walk = (
    blocks: readonly RecipeBlock[],
    factor: number,
    prefix: string,
    parent: { head: CookBlock; group: string } | null
  ): FlatBlock[] =>
    blocks.flatMap((block, index): FlatBlock[] => {
      const key = `${prefix}${index}`;
      if (block.kind === "RECIPE") {
        const sub = block.recipe;
        if (!sub) return [];
        const top = parent ?? {
          head: { title: sub.title, linked: true, amount: scaledAmount(block, units, factor) },
          group: key,
        };
        const subFactor =
          factor *
          linkFactor(
            { quantity: block.quantity, unit: unitOf(block.unitId) },
            { yieldQuantity: sub.yieldQuantity, yieldUnit: unitOf(sub.yieldUnitId) }
          );
        return walk(sub.blocks, subFactor, `${key}.`, top);
      }
      if (parent) return [{ block, key, scale: factor, ...parent }];
      const head = block.title ? { title: block.title, linked: false, amount: null } : null;
      return [{ block, key, scale: factor, head, group: key }];
    });
  return walk(recipe.blocks, scale, "", null);
}

function lines(flat: FlatBlock, units: readonly Unit[]): CookLine[] {
  return flat.block.ingredients.map((line, index) => ({
    key: `${flat.key}:${index}`,
    amount: scaledAmount(line, units, flat.scale),
    name: line.name,
    note: line.note,
  }));
}

/** Le nom (ou son pluriel) apparait-il comme mot dans le texte ? Sans casse ni accents. */
function mentions(text: string, names: readonly (string | null)[]): boolean {
  const haystack = ` ${normalizeName(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return names.some((name) => {
    if (!name) return false;
    const needle = normalizeName(name)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
}

export function cookSteps(recipe: Recipe, units: readonly Unit[], scale: number): CookStep[] {
  return flatten(recipe, units, scale).flatMap((flat) => {
    const all = lines(flat, units);
    return flat.block.steps.map((text) => ({
      text,
      block: flat.head,
      ingredients: all.filter((_, index) => {
        const line = flat.block.ingredients[index];
        return line ? mentions(text, [line.name, line.namePlural]) : false;
      }),
    }));
  });
}

/** F-INGREDIENTS : un groupe par sous-recette ou bloc titre, dans l'ordre. */
export function cookIngredientGroups(
  recipe: Recipe,
  units: readonly Unit[],
  scale: number
): CookGroup[] {
  const groups = new Map<string, CookGroup>();
  for (const flat of flatten(recipe, units, scale)) {
    const group = groups.get(flat.group);
    if (group) group.ingredients.push(...lines(flat, units));
    else {
      const head = flat.head ?? { title: "", linked: false, amount: null };
      groups.set(flat.group, { ...head, ingredients: lines(flat, units) });
    }
  }
  return [...groups.values()].filter((group) => group.ingredients.length > 0);
}
