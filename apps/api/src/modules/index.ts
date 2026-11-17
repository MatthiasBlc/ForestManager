// Liste statique des modules (D71) : seul endroit qui importe les manifestes.
// Le socle la recoit par injection (server.ts, seed, tests) et ne l'importe jamais.
import type { ApiModule } from "../core/modules/registry.ts";
import { mealPlanModule } from "./meal-plan/manifest.ts";
import { recipesModule } from "./recipes/manifest.ts";
import { shoppingModule } from "./shopping/manifest.ts";

export const MODULES: readonly ApiModule[] = [recipesModule, mealPlanModule, shoppingModule];
