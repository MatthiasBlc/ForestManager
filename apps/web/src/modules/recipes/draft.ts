// Brouillon de l'editeur (D104) : etat du formulaire, conversion depuis une
// recette et vers le corps de l'API, sauvegarde sur l'appareil.
import type { CreateRecipeBody, Recipe } from "@fm/shared";

import type { IngredientLine } from "./components/quantity-input.tsx";

export interface DraftBlock {
  key: string;
  title: string;
  lines: (IngredientLine & { key: string })[];
  steps: { key: string; text: string }[];
}

export interface Draft {
  title: string;
  yieldQuantity: number;
  yieldUnitId: string | null;
  prepMinutes: string;
  cookMinutes: string;
  restMinutes: string;
  notes: string;
  sourceUrl: string;
  isBase: boolean;
  globalTagIds: string[];
  spaceTagIds: string[];
  blocks: DraftBlock[];
}

/** Cle stable d'une ligne (aussi unique apres restauration d'un brouillon). */
export function newKey(): string {
  return crypto.randomUUID();
}

export function emptyLine(): DraftBlock["lines"][number] {
  return { key: newKey(), quantity: "", unitId: "", name: "", ingredientId: null };
}

export function emptyBlock(): DraftBlock {
  return { key: newKey(), title: "", lines: [emptyLine()], steps: [{ key: newKey(), text: "" }] };
}

export function emptyDraft(): Draft {
  return {
    title: "",
    yieldQuantity: 4,
    yieldUnitId: null,
    prepMinutes: "",
    cookMinutes: "",
    restMinutes: "",
    notes: "",
    sourceUrl: "",
    isBase: false,
    globalTagIds: [],
    spaceTagIds: [],
    blocks: [emptyBlock()],
  };
}

const minutesText = (value: number | null) => (value === null ? "" : String(value));
const quantityText = (value: number | null) =>
  value === null ? "" : String(value).replace(".", ",");

export function draftFromRecipe(recipe: Recipe): Draft {
  return {
    title: recipe.title,
    yieldQuantity: recipe.yieldQuantity,
    yieldUnitId: recipe.yieldUnitId,
    prepMinutes: minutesText(recipe.prepMinutes),
    cookMinutes: minutesText(recipe.cookMinutes),
    restMinutes: minutesText(recipe.restMinutes),
    notes: recipe.notes ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    isBase: recipe.isBase,
    globalTagIds: recipe.tags.filter((t) => t.scope === "GLOBAL").map((t) => t.id),
    spaceTagIds: recipe.tags.filter((t) => t.scope === "SPACE").map((t) => t.id),
    blocks: recipe.blocks.map((block) => ({
      key: newKey(),
      title: block.title ?? "",
      lines: [
        ...block.ingredients.map((line) => ({
          key: newKey(),
          quantity: quantityText(line.quantity),
          unitId: line.unitId ?? "",
          name: line.name,
          ingredientId: line.ingredientId,
        })),
        emptyLine(),
      ],
      steps: [...block.steps.map((text) => ({ key: newKey(), text })), { key: newKey(), text: "" }],
    })),
  };
}

/** "1,5" -> 1.5 ; "" -> null ; NaN si illisible. */
export function parseQuantity(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

function parseMinutes(text: string): number | null {
  const clean = text.trim();
  return clean ? Number(clean) : null;
}

export interface DraftErrors {
  title?: string;
  lines: Record<string, string>;
}

/** Erreurs de saisie a corriger avant l'envoi (le schema partage verifie le reste). */
export function draftErrors(draft: Draft): DraftErrors {
  const errors: DraftErrors = { lines: {} };
  if (!draft.title.trim()) errors.title = "Donne un titre à la recette.";
  for (const block of draft.blocks) {
    for (const line of block.lines) {
      if (!line.name.trim()) continue;
      const quantity = parseQuantity(line.quantity);
      if (Number.isNaN(quantity) || quantity === 0) {
        errors.lines[line.key] = "Quantité non lue : écris un nombre, ou choisis « à goût ».";
      }
    }
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return errors.title !== undefined || Object.keys(errors.lines).length > 0;
}

/**
 * Corps de l'API. `ids` donne l'identifiant de chaque ligne dont l'ingredient a
 * ete cree a la volee. Les lignes et etapes vides sont ignorees.
 */
export function draftToBody(draft: Draft, ids: ReadonlyMap<string, string>): CreateRecipeBody {
  return {
    title: draft.title.trim(),
    yieldQuantity: draft.yieldQuantity,
    yieldUnitId: draft.yieldUnitId,
    prepMinutes: parseMinutes(draft.prepMinutes),
    cookMinutes: parseMinutes(draft.cookMinutes),
    restMinutes: parseMinutes(draft.restMinutes),
    notes: draft.notes.trim() || null,
    sourceUrl: draft.sourceUrl.trim() || null,
    isBase: draft.isBase,
    globalTagIds: draft.globalTagIds,
    spaceTagIds: draft.spaceTagIds,
    blocks: draft.blocks.map((block) => ({
      kind: "LOCAL" as const,
      title: block.title.trim() || null,
      ingredients: block.lines
        .filter((line) => line.name.trim())
        .map((line) => ({
          ingredientId: line.ingredientId ?? ids.get(line.key) ?? "",
          quantity: parseQuantity(line.quantity),
          unitId: line.unitId || null,
        })),
      steps: block.steps.map((step) => step.text.trim()).filter(Boolean),
    })),
  };
}

// --- Sauvegarde sur l'appareil ---

const PREFIX = "fm:draft:";

/** Cle d'un brouillon : nouvelle recette d'un espace, ou recette a une revision donnee. */
export function draftKey(spaceId: string, recipe?: { id: string; currentRevision: number }) {
  return recipe ? `${PREFIX}${recipe.id}@${recipe.currentRevision}` : `${PREFIX}new:${spaceId}`;
}

export function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: Draft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Stockage plein ou indisponible : le brouillon n'est qu'un confort.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // idem
  }
}
