// Manifeste web du module Planning [D180] : navigation et routes.
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";

export const mealPlanModule: WebModule = {
  code: "meal-plan",
  nav: () => [{ id: "meal-plan", label: "Planning", icon: "calendar", path: "meal-plan" }],
  Routes: lazy(() => import("./routes.tsx")),
};
