// Manifeste web du module Recettes : navigation, routes et section de F-QUITTER (D84).
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";
import { RECIPE_ACTIVITY, RECIPE_NOTIFICATIONS } from "./notifications.ts";
import { RECIPE_SEARCH_GROUPS, recipeActions } from "./search.ts";
import { RecentRecipes } from "./widgets.tsx";

export const recipesModule: WebModule = {
  code: "recipes",
  // Espace perso : un seul onglet, toutes mes recettes avec filtre par espace (D82, D207).
  nav: (kind) => [
    {
      id: "recipes",
      label: kind === "PERSONAL" ? "Mes recettes" : "Recettes",
      icon: "book-open",
      path: "recipes",
    },
  ],
  Routes: lazy(() => import("./routes.tsx")),
  LeaveSection: lazy(() => import("./leave-section.tsx")),
  notificationCategories: {
    "recipes.sharing": {
      label: "Suggestions et partages",
      hint: "Sur tes recettes : suggestions, demandes de partage",
    },
    "recipes.new": { label: "Nouvelles recettes", hint: "Ajoutées dans tes espaces" },
  },
  notifications: RECIPE_NOTIFICATIONS,
  activity: RECIPE_ACTIVITY,
  pendingTexts: {
    "recipes.suggestions": (count) =>
      `${count} suggestion${count > 1 ? "s" : ""} en attente sur ses recettes.`,
  },
  searchGroups: RECIPE_SEARCH_GROUPS,
  actions: recipeActions,
  widgets: {
    "recipes.recent": { title: "Récemment ajoutées dans tes espaces", Component: RecentRecipes },
  },
};
