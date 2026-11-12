// Recherche globale, groupes et actions du module Recettes [D119, D191].
import type { PaletteAction, SearchGroupView } from "../../app/registry.ts";
import { plural } from "../../lib/plural.ts";

export const RECIPE_SEARCH_GROUPS: Readonly<Record<string, SearchGroupView>> = {
  "recipes.recipes": {
    label: "Recettes",
    render: (item) => ({
      label: item.title,
      icon: "book-open",
      hint: [
        item.spaceName,
        item.data.isBase === true ? "base" : null,
        item.data.adapted === true ? "adaptation" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      to: `/s/${item.spaceId}/recipes/${item.id}`,
    }),
  },
  // Un ingredient ouvre la liste de l'espace filtree sur lui (nom porte par l'etat).
  "recipes.ingredients": {
    label: "Ingrédients",
    render: (item) => ({
      label: item.title,
      icon: "shopping-basket",
      hint: `${plural(Number(item.data.recipeCount ?? 0), "recette", "recettes")} · ${item.spaceName}`,
      to: `/s/${item.spaceId}/recipes?ingredient=${item.id}`,
      state: { ingredientName: item.title },
    }),
  },
};

export function recipeActions(space: { id: string; kind: "PERSONAL" | "GROUP" }): PaletteAction[] {
  return [
    {
      id: "recipes.new",
      label: "Nouvelle recette",
      icon: "plus",
      to: `/s/${space.id}/recipes/new`,
      keywords: "ajouter creer",
    },
    // "Depuis mes recettes" [D203] : seulement dans un espace de groupe.
    ...(space.kind === "GROUP"
      ? [
          {
            id: "recipes.add-mine",
            label: "Ajouter mes recettes",
            icon: "book-open" as const,
            to: `/s/${space.id}/recipes?addMine=1`,
            keywords: "partager importer depuis mes recettes",
          },
        ]
      : []),
  ];
}
