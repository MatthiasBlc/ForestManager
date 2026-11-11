// Registre des modules [D10, D33, D40, D71] : manifestes API, validation au
// demarrage, crochets du cycle de vie et synchro du catalogue `Module`.
// La liste des manifestes vit dans `src/modules/index.ts` ; le socle ne
// l'importe jamais, elle lui est injectee (server.ts, seed, tests).

import {
  validateModuleDefinitions,
  type ModuleDefinition,
  type ModuleStatus,
  type SpaceRole,
} from "@fm/shared";
import type { Router } from "express";

import type { Context } from "../context.ts";
import type { Db } from "../db/client.ts";
import type { ModuleSearch } from "../search/types.ts";
import type { LifecycleHooks } from "./hooks.ts";

export interface ApiModule extends ModuleDefinition {
  /**
   * Entree du catalogue. `status` n'est ecrit qu'a la creation de la ligne (ou au
   * retour d'un code retire) : ensuite il appartient au super admin.
   * `isDefault` et `sortOrder` viennent du code et sont toujours reappliques.
   */
  readonly catalog: {
    readonly status: ModuleStatus;
    readonly isDefault?: boolean;
    readonly sortOrder: number;
  };
  /** Monte sous /api/v1/spaces/:spaceId/<code>, derriere requireAuth et requireModule. */
  readonly router?: (ctx: Context) => Router;
  /**
   * Roles minimaux regles par l'espace pour les permissions `configurable`
   * (D58, D141), lus par requireModule. Une cle absente garde le role du manifeste.
   */
  readonly roleOverrides?: (
    db: Db,
    spaceId: string
  ) => Promise<Readonly<Record<string, SpaceRole>>>;
  /**
   * Services offerts aux autres modules (14-Architecture.md) : cle prefixee par le
   * code du module, fabrique appelee avec le contexte. Contrats dans `modules/services.ts`.
   */
  readonly provides?: Readonly<Record<string, (ctx: Context) => unknown>>;
  /** Services d'autres modules indispensables : l'API ne demarre pas s'ils manquent. */
  readonly requires?: readonly string[];
  readonly onSpaceDeleted?: LifecycleHooks["onSpaceDeleted"][number];
  readonly onMemberLeft?: LifecycleHooks["onMemberLeft"][number];
  readonly storageKeys?: LifecycleHooks["storageKeys"][number];
  /** Recherche globale (P16) : groupes `<code>.<nom>` [D191]. */
  readonly search?: ModuleSearch;
}

/** Segments deja pris par le socle sous /spaces/:spaceId. */
const RESERVED_CODES = new Set([
  "members",
  "modules",
  "transfer",
  "transfers",
  "invite-links",
  "invitations",
  "restore",
  "leave",
  "activity",
]);

/** Leve une erreur si un manifeste est invalide (l'API ne demarre pas). */
export function assertValidModules(modules: readonly ApiModule[]): void {
  const problems = validateModuleDefinitions(modules);
  const provided = new Set<string>();
  for (const module of modules) {
    if (RESERVED_CODES.has(module.code)) problems.push(`module code "${module.code}" is reserved`);
    for (const key of Object.keys(module.provides ?? {})) {
      if (!key.startsWith(`${module.code}.`)) {
        problems.push(
          `service "${key}" of module "${module.code}" must start with "${module.code}."`
        );
      }
      if (provided.has(key)) problems.push(`duplicate service "${key}"`);
      provided.add(key);
    }
  }
  for (const module of modules) {
    for (const key of module.requires ?? []) {
      if (!provided.has(key))
        problems.push(`module "${module.code}" requires missing service "${key}"`);
    }
  }
  if (problems.length > 0) throw new Error(`invalid modules: ${problems.join("; ")}`);
}

export function hooksFrom(modules: readonly ApiModule[]): LifecycleHooks {
  return {
    onSpaceDeleted: modules.flatMap((m) => (m.onSpaceDeleted ? [m.onSpaceDeleted] : [])),
    onMemberLeft: modules.flatMap((m) => (m.onMemberLeft ? [m.onMemberLeft] : [])),
    storageKeys: modules.flatMap((m) => (m.storageKeys ? [m.storageKeys] : [])),
  };
}

/**
 * Aligne le catalogue sur le code (idempotent, appele par le seed a chaque
 * deploy) : code nouveau -> statut declare, code absent -> RETIRED (donnees
 * conservees [D85]), code revenu -> statut declare.
 */
export async function syncCatalog(db: Db, modules: readonly ApiModule[]): Promise<void> {
  const existing = new Map((await db.module.findMany()).map((row) => [row.code, row]));
  for (const module of modules) {
    const { status, isDefault = false, sortOrder } = module.catalog;
    const row = existing.get(module.code);
    if (!row) {
      await db.module.create({ data: { code: module.code, status, isDefault, sortOrder } });
      continue;
    }
    await db.module.update({
      where: { code: module.code },
      data: { isDefault, sortOrder, ...(row.status === "RETIRED" ? { status } : {}) },
    });
  }
  const codes = new Set(modules.map((m) => m.code));
  await db.module.updateMany({
    where: { code: { notIn: [...codes] }, status: { not: "RETIRED" } },
    data: { status: "RETIRED", isDefault: false },
  });
}

/** Service offert par un module de la liste, ou null s'il n'y est pas. */
export function findService(ctx: Context, key: string): unknown {
  for (const module of ctx.modules) {
    const factory = module.provides?.[key];
    if (factory) return factory(ctx);
  }
  return null;
}
