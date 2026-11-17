// Manifeste API du module Liste de courses : declare au catalogue ("bientot"), complete en C9.
import type { ApiModule } from "../../core/modules/registry.ts";

export const shoppingModule: ApiModule = {
  code: "shopping",
  catalog: { status: "COMING_SOON", sortOrder: 3 },
  permissions: {},
};
