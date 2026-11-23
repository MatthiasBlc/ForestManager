// Permissions du module Liste de courses (matrice B2, Reference/Permissions.md) :
// `shopping.edit` se regle par espace (editRole, D141).
import type { ApiModule } from "../../core/modules/registry.ts";

export const SHOPPING_PERMISSIONS = {
  "shopping.view": { minRole: "MEMBER" },
  /** Generer, ajouter, cocher, retirer, gerer les sections [D141, D228]. */
  "shopping.edit": { minRole: "MEMBER", configurable: true },
  /** Changer le role minimal de `shopping.edit`. */
  "shopping.edit-role": { minRole: "OWNER" },
} as const satisfies ApiModule["permissions"];
