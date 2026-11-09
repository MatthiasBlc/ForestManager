// Service `recipes.catalog` offert aux autres modules (Planning) : recettes
// visibles dans un espace, avec les memes regles que la liste [D03, D178].
import type { Context } from "../../core/context.ts";
import { imageUrl } from "../../core/storage/images.ts";
import type { CatalogRecipe, RecipeCatalog } from "../services.ts";
import { notHiddenFrom, visibleIn } from "./service.ts";

export function recipeCatalog(ctx: Context): RecipeCatalog {
  return {
    async visible(spaceId, viewerId, ids) {
      if (ids.length === 0) return new Map();
      const rows = await ctx.db.recipe.findMany({
        where: { id: { in: [...ids] }, ...visibleIn(spaceId), AND: [notHiddenFrom(viewerId)] },
        select: { id: true, title: true, imageKey: true },
      });
      return new Map<string, CatalogRecipe>(
        rows.map((row) => [
          row.id,
          { id: row.id, title: row.title, imageUrl: imageUrl(ctx, row.imageKey) },
        ])
      );
    },
  };
}
