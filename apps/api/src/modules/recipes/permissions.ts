// Permissions du module Recettes (matrice B2, 12-Permissions.md, Recettes et Tags) :
// roles minimaux par defaut. Partagees par le manifeste et les services qui jugent
// un espace autre que celui de la requete (decideur d'une demande de partage).
import { isAllowed, modulePermissionDefinition, type SpaceKind, type SpaceRole } from "@fm/shared";

import type { ApiModule } from "../../core/modules/registry.ts";

export const RECIPE_PERMISSIONS = {
  "recipes.view": { minRole: "MEMBER" },
  "recipes.create": { minRole: "MEMBER" },
  "recipes.moderate": { minRole: "MODERATOR" },
  "recipes.tags.create": { minRole: "MEMBER" },
  "recipes.tags.moderate": { minRole: "MODERATOR" },
} as const satisfies ApiModule["permissions"];

/** `recipes.moderate` pour ce role dans un espace de ce type. */
export function canModerate(kind: SpaceKind, role: SpaceRole): boolean {
  return isAllowed(modulePermissionDefinition(RECIPE_PERMISSIONS["recipes.moderate"]), {
    authenticated: true,
    space: { kind, role },
  });
}
