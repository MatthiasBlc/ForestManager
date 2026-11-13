// Recettes composees [D24] : controle du graphe des liens a l'ecriture (pas de
// boucle, 3 niveaux) et chargement des sous-recettes a la lecture (lien vivant).
import { checkComposition, MAX_RECIPE_LEVELS, type LinkStatus } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { blockInclude } from "./content.ts";

type Tx = Context["db"] | Prisma.TransactionClient;

function push(map: Map<string, string[]>, key: string, value: string) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

/**
 * Refuse une boucle (RECIPE_007) ou plus de MAX_RECIPE_LEVELS niveaux (RECIPE_008)
 * pour `rootId` liee a `links`. `rootId` null : recette en creation (sans parent).
 */
export async function assertComposition(
  db: Tx,
  rootId: string | null,
  links: readonly string[]
): Promise<void> {
  if (links.length === 0) return;
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();

  // Descendants des nouveaux liens ; un niveau de plus que permis suffit a juger.
  let frontier = [...new Set(links)];
  const seen = new Set(frontier);
  for (let level = 0; level < MAX_RECIPE_LEVELS && frontier.length > 0; level += 1) {
    const edges = await db.recipeBlock.findMany({
      where: { recipeId: { in: frontier }, kind: "RECIPE", subRecipeId: { not: null } },
      select: { recipeId: true, subRecipeId: true },
    });
    frontier = [];
    for (const edge of edges) {
      const child = edge.subRecipeId ?? "";
      push(childrenOf, edge.recipeId, child);
      if (!seen.has(child)) {
        seen.add(child);
        frontier.push(child);
      }
    }
  }

  // Recettes (non supprimees) qui utilisent deja la racine.
  if (rootId) {
    let up = [rootId];
    const above = new Set(up);
    for (let level = 0; level < MAX_RECIPE_LEVELS && up.length > 0; level += 1) {
      const edges = await db.recipeBlock.findMany({
        where: { subRecipeId: { in: up }, recipe: { deletedAt: null } },
        select: { recipeId: true, subRecipeId: true },
      });
      up = [];
      for (const edge of edges) {
        push(parentsOf, edge.subRecipeId ?? "", edge.recipeId);
        if (!above.has(edge.recipeId)) {
          above.add(edge.recipeId);
          up.push(edge.recipeId);
        }
      }
    }
  }

  const error = checkComposition(rootId ?? "", links, { childrenOf, parentsOf });
  if (error === "CYCLE") throw new AppError("RECIPE_007");
  if (error === "DEPTH") throw new AppError("RECIPE_008");
}

function linkedSelect(spaceId: string) {
  return {
    id: true,
    title: true,
    yieldQuantity: true,
    yieldUnitId: true,
    isBase: true,
    homeSpaceId: true,
    deletedAt: true,
    blocks: blockInclude,
    shares: { where: { spaceId, removedAt: null }, select: { id: true } },
  } satisfies Prisma.RecipeSelect;
}

export type LinkedRow = Prisma.RecipeGetPayload<{ select: ReturnType<typeof linkedSelect> }>;

/** Sous-recette chargee, avec son statut vu depuis l'espace courant. */
export interface LoadedLink {
  status: LinkStatus;
  row: LinkedRow;
}

/** Statut d'une sous-recette vue depuis `spaceId` : origine ou partage actif [D03]. */
function statusIn(row: LinkedRow, spaceId: string): LinkStatus {
  if (row.deletedAt) return "DELETED";
  return row.homeSpaceId === spaceId || row.shares.length > 0 ? "AVAILABLE" : "HIDDEN";
}

/** Charge les sous-recettes liees par `blocks`, niveau par niveau (lien vivant). */
export async function loadLinks(
  db: Tx,
  blocks: readonly { subRecipeId: string | null }[],
  spaceId: string
): Promise<Map<string, LoadedLink>> {
  const loaded = new Map<string, LoadedLink>();
  let ids = blocks.flatMap((block) => (block.subRecipeId ? [block.subRecipeId] : []));
  for (let level = 1; level < MAX_RECIPE_LEVELS && ids.length > 0; level += 1) {
    const rows = await db.recipe.findMany({
      where: { id: { in: [...new Set(ids)].filter((id) => !loaded.has(id)) } },
      select: linkedSelect(spaceId),
    });
    ids = [];
    for (const row of rows) {
      const status = statusIn(row, spaceId);
      loaded.set(row.id, { status, row });
      if (status !== "AVAILABLE") continue;
      for (const block of row.blocks) if (block.subRecipeId) ids.push(block.subRecipeId);
    }
  }
  return loaded;
}

/** Recettes non supprimees qui lient `recipeId`. */
export function countUsedBy(db: Tx, recipeId: string): Promise<number> {
  return db.recipe.count({
    where: { deletedAt: null, blocks: { some: { subRecipeId: recipeId } } },
  });
}
