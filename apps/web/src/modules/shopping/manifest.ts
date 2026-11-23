// Manifeste web du module Liste de courses [D228] : onglet "Courses" et routes.
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";

export const shoppingModule: WebModule = {
  code: "shopping",
  nav: () => [{ id: "shopping", label: "Courses", icon: "shopping-basket", path: "shopping" }],
  Routes: lazy(() => import("./routes.tsx")),
};
