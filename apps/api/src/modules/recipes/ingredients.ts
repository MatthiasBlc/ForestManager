// Service `recipes.ingredients` offert a la liste de courses [D24, D228] :
// ingredients d'une recette entiere, sous-recettes depliees a l'echelle de la
// quantite utilisee (lien vivant), sous-recettes invisibles signalees.
import { linkFactor, type UnitDef } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { RecipeIngredientLine, RecipeIngredients, ShoppingRecipe } from "../services.ts";
import { loadLinks, type LoadedLink } from "./composition.ts";
import { notHiddenFrom, visibleIn } from "./service.ts";

interface Block {
  kind: string;
  title: string | null;
  subRecipeId: string | null;
  subQuantity: number | null;
  subUnitId: string | null;
  ingredients: {
    ingredientId: string;
    quantity: number | null;
    unitId: string | null;
    optional: boolean;
  }[];
}

export function recipeIngredients(ctx: Context): RecipeIngredients {
  return {
    async forShopping(spaceId, viewerId, ids) {
      if (ids.length === 0) return new Map();
      const [rows, units] = await Promise.all([
        ctx.db.recipe.findMany({
          where: { id: { in: [...ids] }, ...visibleIn(spaceId), AND: [notHiddenFrom(viewerId)] },
          select: {
            id: true,
            title: true,
            yieldQuantity: true,
            yieldUnitId: true,
            blocks: {
              orderBy: { position: "asc" },
              include: { ingredients: { orderBy: { position: "asc" } } },
            },
          },
        }),
        ctx.db.unit.findMany({
          select: { id: true, code: true, dimension: true, toBase: true, metric: true },
        }),
      ]);
      const unitOf = new Map<string, UnitDef>(units.map((unit) => [unit.id, unit]));
      const unit = (id: string | null) => (id ? (unitOf.get(id) ?? null) : null);
      const links = await loadLinks(
        ctx.db,
        rows.flatMap((row) => row.blocks),
        spaceId
      );

      const result = new Map<string, ShoppingRecipe>();
      for (const row of rows) {
        const lines: RecipeIngredientLine[] = [];
        const missing: string[] = [];
        const walk = (blocks: readonly Block[], factor: number) => {
          for (const block of blocks) {
            if (block.kind !== "RECIPE") {
              for (const line of block.ingredients) {
                lines.push({
                  ingredientId: line.ingredientId,
                  quantity: line.quantity === null ? null : line.quantity * factor,
                  unitId: line.unitId,
                  optional: line.optional,
                });
              }
              continue;
            }
            const link: LoadedLink | undefined = block.subRecipeId
              ? links.get(block.subRecipeId)
              : undefined;
            if (link?.status !== "AVAILABLE") {
              missing.push(link?.row.title ?? block.title ?? "");
              continue;
            }
            const sub = link.row;
            const subFactor =
              block.subQuantity === null
                ? factor
                : factor *
                  linkFactor(
                    { quantity: block.subQuantity, unit: unit(block.subUnitId) },
                    { yieldQuantity: sub.yieldQuantity, yieldUnit: unit(sub.yieldUnitId) }
                  );
            walk(sub.blocks, subFactor);
          }
        };
        walk(row.blocks, 1);
        result.set(row.id, {
          id: row.id,
          title: row.title,
          yieldQuantity: row.yieldQuantity,
          inPortions: row.yieldUnitId === null,
          lines,
          missing,
        });
      }
      return result;
    },
  };
}
