// Faux serveur du module Planning (MSW) sur l'espace groupe de spaceServer :
// module actif, reglages et droits du lecteur, repas d'une periode, ecriture,
// vidage, echange, recherche de recettes (espace et "mes recettes") et partage.
// Garde l'etat et les corps recus.
import {
  sortMealTimes,
  type Meal,
  type MealCell,
  type MealPlanRights,
  type MealPlanSettings,
  type PutMealBody,
  type RecipeSummary,
  type ShareStatus,
  type SpaceRole,
  type SwapMealsBody,
  type UpdateMealPlanSettingsBody,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { buildRecipe, NOW, toSummary } from "./fixtures.ts";
import { server } from "./server.ts";
import { spaceServer } from "./space-server.ts";

function rightsFor(role: SpaceRole, editRole: SpaceRole): MealPlanRights {
  const rank = { MEMBER: 0, MODERATOR: 1, OWNER: 2 } as const;
  return {
    edit: rank[role] >= rank[editRole],
    manage: rank[role] >= rank.MODERATOR,
    setEditRole: role === "OWNER",
  };
}

/** Repas pour un test : seuls la case et le titre sont obligatoires. */
export function buildMeal(over: Partial<Meal> & MealCell): Meal {
  return {
    kind: "TEXT",
    title: "Soupe",
    recipe: null,
    comment: null,
    servings: null,
    locked: false,
    updatedBy: null,
    updatedAt: NOW,
    ...over,
  };
}

const sameCell = (meal: MealCell, cell: MealCell) =>
  meal.date === cell.date && meal.mealTime === cell.mealTime;

export function mealPlanServer({
  myRole = "MEMBER",
  settings = {},
  meals = [],
  spaceRecipes = [],
  myRecipes = [],
  shareResult = "SHARED",
}: {
  myRole?: SpaceRole;
  settings?: Partial<Omit<MealPlanSettings, "can">>;
  meals?: Meal[];
  /** Recettes visibles dans l'espace (recherche de F-REPAS). */
  spaceRecipes?: RecipeSummary[];
  /** "Mes recettes" de tous mes espaces. */
  myRecipes?: RecipeSummary[];
  /** Reponse a une demande de partage depuis F-REPAS. */
  shareResult?: ShareStatus;
} = {}) {
  const s = spaceServer({ myRole });
  s.space.modules = [
    { code: "recipes", sortOrder: 0 },
    { code: "meal-plan", sortOrder: 1 },
  ];
  const values = {
    mealTimes: ["LUNCH", "DINNER"],
    defaultServings: 4,
    weekStartsOn: "MON",
    editRole: "MEMBER",
    ...settings,
  } as Omit<MealPlanSettings, "can">;
  const state = {
    settings: values,
    saved: [] as UpdateMealPlanSettingsBody[],
    meals: [...meals],
    /** Periodes lues (`from` et `to`). */
    reads: [] as { from: string; to: string }[],
    puts: [] as (PutMealBody & MealCell)[],
    clears: [] as MealCell[],
    swaps: [] as SwapMealsBody[],
    shareRequests: [] as { recipeId: string; targetSpaceId: string }[],
  };
  const base = `/api/v1/spaces/${s.space.id}/meal-plan`;
  const current = (): MealPlanSettings => ({
    ...state.settings,
    can: rightsFor(myRole, state.settings.editRole),
  });
  const allRecipes = () => [...spaceRecipes, ...myRecipes];
  const matching = (list: RecipeSummary[], url: URL) => {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return list.filter((recipe) => recipe.title.toLowerCase().includes(q));
  };

  server.use(
    http.get(`${base}/settings`, () => HttpResponse.json(current())),
    http.put(`${base}/settings`, async ({ request }) => {
      const body = (await request.json()) as UpdateMealPlanSettingsBody;
      state.saved.push(body);
      state.settings = {
        ...state.settings,
        ...body,
        mealTimes: sortMealTimes(body.mealTimes),
        editRole: body.editRole ?? state.settings.editRole,
      };
      return HttpResponse.json(current());
    }),
    http.get(`${base}/meals`, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      state.reads.push({ from, to });
      const data = state.meals
        .filter((meal) => meal.date >= from && meal.date <= to)
        .sort((a, b) => (a.date + a.mealTime).localeCompare(b.date + b.mealTime));
      return HttpResponse.json({ data });
    }),
    http.post(`${base}/meals/swap`, async ({ request }) => {
      const body = (await request.json()) as SwapMealsBody;
      state.swaps.push(body);
      state.meals = state.meals.map((meal) => {
        if (sameCell(meal, body.a)) return { ...meal, ...body.b };
        if (sameCell(meal, body.b)) return { ...meal, ...body.a };
        return meal;
      });
      return HttpResponse.json({ data: [] });
    }),
    http.put(`${base}/meals/:date/:mealTime`, async ({ params, request }) => {
      const cell = { date: String(params.date), mealTime: params.mealTime } as MealCell;
      const body = (await request.json()) as PutMealBody;
      state.puts.push({ ...cell, ...body });
      const recipe =
        body.kind === "RECIPE" ? allRecipes().find((r) => r.id === body.recipeId) : undefined;
      const meal = buildMeal({
        ...cell,
        kind: body.kind,
        title: body.kind === "TEXT" ? body.text : (recipe?.title ?? null),
        recipe: recipe ? { id: recipe.id, imageUrl: null } : null,
        comment: body.kind === "SKIPPED" ? null : (body.comment ?? null),
        servings: body.kind === "SKIPPED" ? null : (body.servings ?? null),
        locked: body.kind === "SKIPPED" ? false : (body.locked ?? false),
      });
      state.meals = [...state.meals.filter((m) => !sameCell(m, cell)), meal];
      return HttpResponse.json(meal);
    }),
    http.delete(`${base}/meals/:date/:mealTime`, ({ params }) => {
      const cell = { date: String(params.date), mealTime: params.mealTime } as MealCell;
      state.clears.push(cell);
      state.meals = state.meals.filter((m) => !sameCell(m, cell));
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`/api/v1/spaces/${s.space.id}/recipes`, ({ request }) =>
      HttpResponse.json({
        data: matching(spaceRecipes, new URL(request.url)),
        nextCursor: null,
      })
    ),
    http.get(`/api/v1/spaces/${s.space.id}/recipes/mine`, ({ request }) =>
      HttpResponse.json({ data: matching(myRecipes, new URL(request.url)), nextCursor: null })
    ),
    http.post(
      "/api/v1/spaces/:homeId/recipes/:recipeId/share-requests",
      async ({ params, request }) => {
        const body = (await request.json()) as { targetSpaceId: string };
        state.shareRequests.push({ recipeId: String(params.recipeId), ...body });
        if (shareResult === "SHARED") {
          const recipe = myRecipes.find((r) => r.id === params.recipeId);
          if (recipe) spaceRecipes.push(recipe);
        }
        return HttpResponse.json({ status: shareResult }, { status: 201 });
      }
    )
  );
  return { ...s, plan: state };
}

/** Recette resumee d'un autre espace (pour "mes recettes"). */
export function recipeElsewhere(title: string): RecipeSummary {
  return toSummary(buildRecipe({ title }));
}
