// Widget d'accueil des Recettes [D193] : recemment ajoutees dans ses espaces,
// une ligne par recette (son espace d'origine s'il en fait partie).
import type { ApiWidget } from "../../core/home/types.ts";
import { Prisma } from "../../core/db/client.ts";
import { imageUrl } from "../../core/storage/images.ts";

const RECENT = 4;

interface Row {
  id: string;
  title: string;
  imageKey: string | null;
  isBase: boolean;
  adapted: boolean;
  author: string | null;
  spaceId: string;
  spaceName: string;
}

export const RECIPE_WIDGETS: Readonly<Record<string, ApiWidget>> = {
  "recipes.recent": {
    default: true,
    order: 30,
    async load(ctx, input) {
      const ids = Prisma.join(input.spaces.map((space) => space.id));
      const rows = await ctx.db.$queryRaw<Row[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (r.id) r.id, r.title, r."imageKey", r."isBase", r."createdAt",
            (r."adaptedFromId" IS NOT NULL) AS adapted,
            CASE WHEN u."deletedAt" IS NULL THEN u.username END AS author,
            s.id AS "spaceId", s.name AS "spaceName"
          FROM "Recipe" r
          JOIN "User" u ON u.id = r."authorId"
          JOIN "Space" s ON s.id IN (${ids}) AND (r."homeSpaceId" = s.id OR EXISTS (
            SELECT 1 FROM "RecipeShare" sh
            WHERE sh."recipeId" = r.id AND sh."spaceId" = s.id AND sh."removedAt" IS NULL))
          WHERE r."deletedAt" IS NULL
            AND (r."hiddenAt" IS NULL OR r."authorId" = ${input.userId})
          ORDER BY r.id, (s.id = r."homeSpaceId") DESC, s.name
        ) found
        ORDER BY "createdAt" DESC, id
        LIMIT ${RECENT}`;
      return {
        recipes: rows.map((row) => ({
          id: row.id,
          title: row.title,
          imageUrl: imageUrl(ctx, row.imageKey),
          author: row.author,
          isBase: row.isBase,
          adapted: row.adapted,
          spaceId: row.spaceId,
          spaceName: row.spaceName,
        })),
      };
    },
  },
};
