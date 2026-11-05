// Manifeste web du module Recettes. C2 : navigation et page d'attente ; les
// ecrans arrivent en C3.
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
};
