// Contrats des services entre modules (Reference/Architecture.md, `provides` / `requires`).
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

/** Recette proposable par la generation. */
export interface PoolRecipeInfo {
  id: string;
  title: string;
  isBase: boolean;
  tagIds: string[];
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
  /**
   * Pool de la generation [D184] : recettes visibles dans l'espace, non supprimees,
   * non masquees (pour personne), avec leurs tags globaux et ceux de cet espace.
   */
  pool(spaceId: string): Promise<PoolRecipeInfo[]>;
  /** Recette non supprimee, nee dans l'espace et ecrite par cet auteur (idee convertie, D182). */
  isAuthoredIn(spaceId: string, authorId: string, recipeId: string): Promise<boolean>;
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

/** Repas d'une periode, vu par la liste de courses. */
export interface PlannedMeal {
  id: string;
  date: string;
  mealTime: "LUNCH" | "DINNER";
  kind: "RECIPE" | "TEXT" | "SKIPPED";
  recipeId: string | null;
  /** Texte libre, ou dernier titre connu d'une recette [D184]. */
  text: string | null;
  /** Portions effectives (celles du repas, sinon celles de l'espace). */
  servings: number;
}

/** Fourni par le Planning : repas de la periode, null si le module n'est pas actif dans l'espace. */
export interface MealPlanPeriod {
  meals(spaceId: string, from: string, to: string): Promise<PlannedMeal[] | null>;
}

/** Ligne d'ingredient d'une recette, sous-recettes depliees, pour la recette entiere. */
export interface RecipeIngredientLine {
  ingredientId: string;
  quantity: number | null;
  unitId: string | null;
  optional: boolean;
}

export interface ShoppingRecipe {
  id: string;
  title: string;
  yieldQuantity: number;
  /** Rendement en portions (pas d'unite) : se met a l'echelle des portions d'un repas. */
  inPortions: boolean;
  lines: RecipeIngredientLine[];
  /** Titres des sous-recettes invisibles ou supprimees : leurs ingredients manquent. */
  missing: string[];
}

/** Fourni par Recettes : ingredients des recettes visibles dans un espace [D24, D228]. */
export interface RecipeIngredients {
  forShopping(
    spaceId: string,
    viewerId: string,
    ids: readonly string[]
  ): Promise<Map<string, ShoppingRecipe>>;
}

export interface ModuleServices {
  "recipes.catalog": RecipeCatalog;
  "recipes.ingredients": RecipeIngredients;
  "meal-plan.recipeStats": MealPlanStats;
  "meal-plan.period": MealPlanPeriod;
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
