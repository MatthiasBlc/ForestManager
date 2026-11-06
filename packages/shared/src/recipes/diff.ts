// Differences entre deux contenus de recette, champ par champ (logique pure,
// partagee API et web) : comparer une adaptation a son original [D17, D105],
// lire une suggestion [D04]. Ingredients apparies par ingredient dans un bloc,
// etapes et blocs par position.
import type { LocalBlock, RecipeIngredient } from "../schemas/recipes.ts";

/** Bloc lie dans un contenu lu : la recette visee et son titre (null si supprimee). */
export interface ContentLink {
  kind: "RECIPE";
  recipeId: string;
  title: string | null;
  quantity: number;
  unitId: string | null;
}

export type ContentBlock = LocalBlock | ContentLink;

/** Contenu versionne d'une recette, avec les noms lisibles (sans tags, D19). */
export interface RecipeContentView {
  title: string;
  description: string | null;
  notes: string | null;
  sourceUrl: string | null;
  yieldQuantity: number;
  yieldUnitId: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  isBase: boolean;
  blocks: ContentBlock[];
}

export const DIFF_FIELDS = [
  "title",
  "description",
  "notes",
  "source",
  "yield",
  "prep",
  "cook",
  "rest",
  "base",
] as const;
export type DiffField = (typeof DIFF_FIELDS)[number];

export type FieldValue =
  string | number | boolean | null | { quantity: number; unitId: string | null };

export type DiffEntry =
  | { kind: "field"; field: DiffField; before: FieldValue; after: FieldValue }
  /** Bloc ajoute (before null), retire (after null), lien ou titre change. */
  | { kind: "block"; block: number; before: ContentBlock | null; after: ContentBlock | null }
  | {
      kind: "ingredient";
      block: number;
      blockTitle: string | null;
      before: RecipeIngredient | null;
      after: RecipeIngredient | null;
    }
  | {
      kind: "step";
      block: number;
      blockTitle: string | null;
      before: string | null;
      after: string | null;
    };

const FIELD_VALUES: Record<DiffField, (c: RecipeContentView) => FieldValue> = {
  title: (c) => c.title,
  description: (c) => c.description,
  notes: (c) => c.notes,
  source: (c) => c.sourceUrl,
  yield: (c) => ({ quantity: c.yieldQuantity, unitId: c.yieldUnitId }),
  prep: (c) => c.prepMinutes,
  cook: (c) => c.cookMinutes,
  rest: (c) => c.restMinutes,
  base: (c) => c.isBase,
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Ce qui compte dans une ligne (le nom suit l'ingredient). */
const lineKey = (line: RecipeIngredient) => [line.quantity, line.unitId, line.note, line.optional];

function diffIngredients(
  block: number,
  blockTitle: string | null,
  before: readonly RecipeIngredient[],
  after: readonly RecipeIngredient[]
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const remaining = [...after];
  for (const line of before) {
    const index = remaining.findIndex((other) => other.ingredientId === line.ingredientId);
    if (index === -1) {
      entries.push({ kind: "ingredient", block, blockTitle, before: line, after: null });
      continue;
    }
    const [match] = remaining.splice(index, 1);
    if (match && !same(lineKey(line), lineKey(match))) {
      entries.push({ kind: "ingredient", block, blockTitle, before: line, after: match });
    }
  }
  // Modifiees et retirees dans l'ordre d'origine, puis ajoutees.
  for (const line of remaining) {
    entries.push({ kind: "ingredient", block, blockTitle, before: null, after: line });
  }
  return entries;
}

function diffSteps(
  block: number,
  blockTitle: string | null,
  before: readonly string[],
  after: readonly string[]
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const a = before[i] ?? null;
    const b = after[i] ?? null;
    if (a !== b) entries.push({ kind: "step", block, blockTitle, before: a, after: b });
  }
  return entries;
}

/** Ce qui a change de `before` a `after`, dans l'ordre d'affichage. */
export function diffContents(before: RecipeContentView, after: RecipeContentView): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const field of DIFF_FIELDS) {
    const a = FIELD_VALUES[field](before);
    const b = FIELD_VALUES[field](after);
    if (!same(a, b)) entries.push({ kind: "field", field, before: a, after: b });
  }
  const count = Math.max(before.blocks.length, after.blocks.length);
  for (let i = 0; i < count; i++) {
    const a = before.blocks[i] ?? null;
    const b = after.blocks[i] ?? null;
    if (a?.kind === "LOCAL" && b?.kind === "LOCAL") {
      if (a.title !== b.title) entries.push({ kind: "block", block: i, before: a, after: b });
      entries.push(...diffIngredients(i, b.title, a.ingredients, b.ingredients));
      entries.push(...diffSteps(i, b.title, a.steps, b.steps));
    } else if (!same(a, b)) {
      entries.push({ kind: "block", block: i, before: a, after: b });
    }
  }
  return entries;
}
