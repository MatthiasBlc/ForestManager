// Contrats des services entre modules (14-Architecture.md, `provides` / `requires`).
// Un module n'importe jamais un autre module : il demande un service par sa cle,
// le registre le trouve dans la liste injectee. Ce fichier ne porte que des types
// et l'acces type ; chaque module fournit son implementation dans son manifeste.
import type { Context } from "../core/context.ts";
import { findService } from "../core/modules/registry.ts";

/** Recette vue depuis un espace, pour un lecteur donne. */
export interface CatalogRecipe {
  id: string;
  title: string;
  imageUrl: string | null;
}

/** Fourni par Recettes : recettes visibles dans un espace (origine ou partage actif). */
export interface RecipeCatalog {
  /**
   * Parmi `ids`, celles visibles dans l'espace pour ce lecteur : non supprimees et
   * non masquees par la moderation (sauf pour leur auteur) [D03, D178].
   */
  visible(
    spaceId: string,
    viewerId: string,
    ids: readonly string[]
  ): Promise<Map<string, CatalogRecipe>>;
}

/** Compteurs du planning sur une recette [D39]. */
export interface RecipePlanningStats {
  count: number;
  /** Derniere date passee (ou du jour) ou elle a ete planifiee. */
  lastOn: string | null;
}

/** Fourni par le Planning : compteurs D39, null si le module n'est pas actif dans l'espace. */
export interface MealPlanStats {
  forRecipe(spaceId: string, recipeId: string): Promise<RecipePlanningStats | null>;
}

export interface ModuleServices {
  "recipes.catalog": RecipeCatalog;
  "meal-plan.recipeStats": MealPlanStats;
}

export type ServiceKey = keyof ModuleServices;

/** Implementation d'un service, typee par son contrat. */
export function provide<K extends ServiceKey>(
  _key: K,
  factory: (ctx: Context) => ModuleServices[K]
): (ctx: Context) => ModuleServices[K] {
  return factory;
}

/** Service optionnel : null quand le module qui le fournit est absent. */
export function optionalService<K extends ServiceKey>(
  ctx: Context,
  key: K
): ModuleServices[K] | null {
  return findService(ctx, key) as ModuleServices[K] | null;
}

/** Service declare dans `requires` : sa presence est verifiee au demarrage. */
export function requiredService<K extends ServiceKey>(ctx: Context, key: K): ModuleServices[K] {
  const service = optionalService(ctx, key);
  if (!service) throw new Error(`missing required service "${key}"`);
  return service;
}
