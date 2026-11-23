// Manifeste web du module Liste de courses [D228] : onglet "Courses", routes et activite.
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";
import { SHOPPING_ACTIVITY } from "./activity.ts";

export const shoppingModule: WebModule = {
  code: "shopping",
  nav: () => [{ id: "shopping", label: "Courses", icon: "shopping-basket", path: "shopping" }],
  Routes: lazy(() => import("./routes.tsx")),
  activity: SHOPPING_ACTIVITY,
};
