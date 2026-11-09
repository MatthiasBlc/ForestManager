// Manifeste web du module Recettes : navigation, routes et section de F-QUITTER (D84).
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";

export const recipesModule: WebModule = {
  code: "recipes",
  nav: (kind) => [
    { id: "recipes", label: "Recettes", icon: "book-open", path: "recipes" },
    ...(kind === "PERSONAL"
      ? [{ id: "mine", label: "Mes recettes", icon: "chef-hat", path: "recipes/mine" } as const]
      : []),
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
};
