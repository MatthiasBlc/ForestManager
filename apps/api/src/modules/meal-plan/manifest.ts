// Manifeste API du module Planning : declare au catalogue ("bientot"), complete en C5.
import type { ApiModule } from "../../core/modules/registry.ts";

export const mealPlanModule: ApiModule = {
  code: "meal-plan",
  catalog: { status: "COMING_SOON", sortOrder: 2 },
  permissions: {},
};
