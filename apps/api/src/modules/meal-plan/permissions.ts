// Permissions du module Planning (matrice B2, 12-Permissions.md, Planning) :
// roles minimaux par defaut ; `meal-plan.edit` se regle par espace (editRole, D58).
import type { ApiModule } from "../../core/modules/registry.ts";

export const MEAL_PLAN_PERMISSIONS = {
  "meal-plan.view": { minRole: "MEMBER" },
  /** Modifier, echanger, verrouiller, remplacer un repas [F-MPL-3]. */
  "meal-plan.edit": { minRole: "MEMBER", configurable: true },
  /** Reglages, profils de generation, generer tout un planning [D58]. */
  "meal-plan.manage": { minRole: "MODERATOR" },
  /** Changer le role minimal de `meal-plan.edit` [F-MPL-3]. */
  "meal-plan.edit-role": { minRole: "OWNER" },
  "meal-plan.ideas.create": { minRole: "MEMBER" },
  /** Modifier ou supprimer l'idee d'un autre membre. */
  "meal-plan.ideas.moderate": { minRole: "MODERATOR" },
} as const satisfies ApiModule["permissions"];
