// Messages de l'activite de la liste de courses : une ligne par ajout depuis le planning, pas par coche [D228].
import type { ActivityRenderer } from "../../app/registry.ts";

export const SHOPPING_ACTIVITY: Record<string, ActivityRenderer> = {
  "shopping.list.generated": (event, spaceId) => {
    const count = typeof event.data?.count === "number" ? event.data.count : 0;
    return {
      text: `a ajouté ${String(count)} ${count > 1 ? "articles" : "article"} à la liste depuis le planning.`,
      to: `/s/${spaceId}/shopping`,
    };
  },
};
