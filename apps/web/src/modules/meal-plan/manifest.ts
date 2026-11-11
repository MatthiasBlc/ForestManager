// Manifeste web du module Planning [D180] : navigation et routes.
import { lazy } from "react";

import type { WebModule } from "../../app/registry.ts";
import { MEAL_PLAN_ACTIVITY, MEAL_PLAN_NOTIFICATIONS } from "./notifications.ts";
import { MEAL_PLAN_SEARCH_GROUPS, mealPlanActions } from "./search.ts";

export const mealPlanModule: WebModule = {
  code: "meal-plan",
  nav: () => [{ id: "meal-plan", label: "Planning", icon: "calendar", path: "meal-plan" }],
  Routes: lazy(() => import("./routes.tsx")),
  notificationCategories: {
    "meal-plan.planning": {
      label: "Planning",
      hint: "Planning généré, repas modifié par quelqu'un d'autre",
    },
  },
  notifications: MEAL_PLAN_NOTIFICATIONS,
  activity: MEAL_PLAN_ACTIVITY,
  searchGroups: MEAL_PLAN_SEARCH_GROUPS,
  actions: mealPlanActions,
};
