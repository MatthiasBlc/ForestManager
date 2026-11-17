// Accueil a widgets (E-ACCUEIL, D60) [D193] : widgets declares par cle
// `<module>.<nom>` (`core.*` pour le socle), choisis et ordonnes par
// l'utilisateur (`User.homeWidgets`, null = defaut du registre). Un seul appel
// `GET /me/home` renvoie les widgets choisis avec leurs donnees.

import { z } from "zod";

import { activityEventSchema } from "../notifications/index.ts";
import { uuidSchema } from "./common.ts";
import { planDateSchema } from "./meal-plan.ts";

export const homeWidgetKeySchema = z.string().regex(/^[a-z][a-z-]*\.[a-z][a-z-]*$/);

/** Liste ordonnee des widgets choisis ; null revient au defaut. */
export const homeWidgetsSchema = z.array(homeWidgetKeySchema).max(20).nullable();

export const homeWidgetSchema = z.object({
  key: homeWidgetKeySchema,
  data: z.record(z.string(), z.unknown()),
});
export type HomeWidget = z.infer<typeof homeWidgetSchema>;

export const homeResponseSchema = z.object({
  /** Widgets choisis, dans l'ordre, avec leurs donnees. */
  widgets: z.array(homeWidgetSchema),
  /** Widgets utilisables (module actif dans au moins un espace), ordre du registre. */
  available: z.array(z.object({ key: homeWidgetKeySchema, default: z.boolean() })),
  /** Faux tant que l'utilisateur garde le choix par defaut. */
  custom: z.boolean(),
});
export type HomeResponse = z.infer<typeof homeResponseSchema>;

// --- Donnees des widgets V2.0 ---

const spaceRef = { spaceId: uuidSchema, spaceName: z.string() };

/** `core.activity` : derniers evenements des espaces groupe. */
export const activityWidgetSchema = z.object({
  events: z.array(z.object({ ...spaceRef, event: activityEventSchema })),
});

/** `recipes.recent` : recettes recemment ajoutees dans ses espaces. */
export const recentRecipesWidgetSchema = z.object({
  recipes: z.array(
    z.object({
      ...spaceRef,
      id: uuidSchema,
      title: z.string(),
      imageUrl: z.string().nullable(),
      author: z.string().nullable(),
      isBase: z.boolean(),
      adapted: z.boolean(),
    })
  ),
});

/** `meal-plan.upcoming` : prochains repas planifies, par espace. */
export const upcomingMealsWidgetSchema = z.object({
  spaces: z.array(
    z.object({
      ...spaceRef,
      meals: z.array(
        z.object({
          date: planDateSchema,
          mealTime: z.enum(["LUNCH", "DINNER"]),
          title: z.string(),
          recipeId: uuidSchema.nullable(),
        })
      ),
    })
  ),
});

/** `meal-plan.most-cooked` : recettes les plus planifiees dans le passe [D39]. */
export const mostCookedWidgetSchema = z.object({
  recipes: z.array(
    z.object({ ...spaceRef, id: uuidSchema, title: z.string(), count: z.number().int() })
  ),
});
