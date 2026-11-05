// Contrat de module [D10, D33, D71] : la partie commune aux manifestes API et
// web. L'API ajoute son routeur et ses crochets (apps/api), le web ses routes
// et sa navigation (apps/web, C2) ; le `code` est le meme partout et en base.

import { z } from "zod";

import { CORE_PERMISSIONS, type ModulePermission } from "../permissions/index.ts";

export const MODULE_STATUSES = ["AVAILABLE", "BETA", "COMING_SOON", "RETIRED"] as const;
export const moduleStatusSchema = z.enum(MODULE_STATUSES);
export type ModuleStatus = z.infer<typeof moduleStatusSchema>;

/** Code de module : minuscules, chiffres et tirets (`recipes`, `meal-plan`). */
export const moduleCodeSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/);
export type ModuleCode = string;

/** Module accorde d'office et toujours actif [D33, D91]. */
export const DEFAULT_MODULE_CODE = "recipes";

export interface ModuleDefinition {
  readonly code: ModuleCode;
  /** Cles prefixees par le code du module : `recipes.create`. */
  readonly permissions: Readonly<Record<string, ModulePermission>>;
  /** Types de notification declares (C6) : `recipes.suggestion.created`. */
  readonly notificationTypes?: readonly string[];
  /** Types d'evenements du fil d'activite (C6). */
  readonly activityTypes?: readonly string[];
}

/**
 * Valide la liste des modules au demarrage : codes valides et uniques,
 * cles (permissions, notifications, activite) prefixees par le code et sans
 * collision avec le socle. Renvoie la liste des problemes (vide si tout va bien).
 */
export function validateModuleDefinitions(modules: readonly ModuleDefinition[]): string[] {
  const problems: string[] = [];
  const codes = new Set<string>();
  // Une collision se cherche par famille de cles (permissions, notifications, activite).
  const seen = {
    permissions: new Set<string>(Object.keys(CORE_PERMISSIONS)),
    notificationTypes: new Set<string>(),
    activityTypes: new Set<string>(),
  };

  for (const module of modules) {
    if (!moduleCodeSchema.safeParse(module.code).success) {
      problems.push(`invalid module code "${module.code}"`);
    }
    if (codes.has(module.code)) problems.push(`duplicate module code "${module.code}"`);
    codes.add(module.code);

    const declared = {
      permissions: Object.keys(module.permissions),
      notificationTypes: module.notificationTypes ?? [],
      activityTypes: module.activityTypes ?? [],
    };
    for (const family of ["permissions", "notificationTypes", "activityTypes"] as const) {
      for (const key of declared[family]) {
        if (!key.startsWith(`${module.code}.`)) {
          problems.push(
            `${family} key "${key}" of module "${module.code}" must start with "${module.code}."`
          );
        }
        if (seen[family].has(key)) problems.push(`duplicate ${family} key "${key}"`);
        seen[family].add(key);
      }
    }
  }
  return problems;
}
