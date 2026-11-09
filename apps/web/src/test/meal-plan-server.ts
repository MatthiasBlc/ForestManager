// Faux serveur du module Planning (MSW) sur l'espace groupe de spaceServer :
// module actif, reglages et droits du lecteur, repas d'une periode, ecriture,
// vidage, echange, recherche de recettes (espace et "mes recettes") et partage.
// Garde l'etat et les corps recus.
import {
  sortMealTimes,
  type ConvertMealIdeaBody,
  type GenerationProfile,
  type GridCell,
  type PutGridBody,
  type Rule,
  type RuleBody,
  type Tag,
  type UpdateGenerationProfileBody,
  type Meal,
  type MealIdea,
  type MealIdeaBody,
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

import { buildRecipe, NOW, toSummary, uuid } from "./fixtures.ts";
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
  ideas = [],
  profiles,
  tags = [VEGETARIAN, FISH],
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
  /** Idees de repas, plus recentes d'abord. */
  ideas?: MealIdea[];
  /** Profils de generation ; par defaut, "Standard" seul [D183]. */
  profiles?: GenerationProfile[];
  /** Tags proposes aux regles et epinglages (globaux). */
  tags?: Tag[];
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
    ideas: [...ideas],
    ideaBodies: [] as MealIdeaBody[],
    conversions: [] as (ConvertMealIdeaBody & { ideaId: string })[],
    profiles: profiles ?? [buildProfile({ name: "Standard", isDefault: true })],
    profilePatches: [] as (UpdateGenerationProfileBody & { profileId: string })[],
    ruleBodies: [] as RuleBody[],
    grids: [] as PutGridBody[],
    deletedProfiles: [] as { id: string; defaultId?: string }[],
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
    http.get(`${base}/ideas`, () => HttpResponse.json({ data: state.ideas })),
    http.post(`${base}/ideas`, async ({ request }) => {
      const body = (await request.json()) as MealIdeaBody;
      state.ideaBodies.push(body);
      const idea = buildIdea({
        name: body.name,
        comment: body.comment ?? null,
        author: { id: s.me.id, username: s.me.username },
      });
      state.ideas = [idea, ...state.ideas];
      return HttpResponse.json(idea, { status: 201 });
    }),
    http.put(`${base}/ideas/:ideaId`, async ({ params, request }) => {
      const body = (await request.json()) as MealIdeaBody;
      state.ideaBodies.push(body);
      state.ideas = state.ideas.map((idea) =>
        idea.id === params.ideaId
          ? { ...idea, name: body.name, comment: body.comment ?? null }
          : idea
      );
      return HttpResponse.json(state.ideas.find((idea) => idea.id === params.ideaId));
    }),
    http.delete(`${base}/ideas/:ideaId`, ({ params }) => {
      state.ideas = state.ideas.filter((idea) => idea.id !== params.ideaId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${base}/ideas/:ideaId/convert`, async ({ params, request }) => {
      const body = (await request.json()) as ConvertMealIdeaBody;
      state.conversions.push({ ideaId: String(params.ideaId), ...body });
      state.ideas = state.ideas.filter((idea) => idea.id !== params.ideaId);
      return new HttpResponse(null, { status: 204 });
    }),
    ...profileHandlers(base, state, tags),
    http.get("/api/v1/tags", () => HttpResponse.json({ data: tags })),
    http.get(`/api/v1/spaces/${s.space.id}/recipes/tags`, () => HttpResponse.json({ data: [] })),
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

export const VEGETARIAN: Tag = {
  id: "00000000-0000-4000-8000-0000000000a1",
  scope: "GLOBAL",
  name: "Végétarien",
};
export const FISH: Tag = {
  id: "00000000-0000-4000-8000-0000000000a2",
  scope: "GLOBAL",
  name: "Poisson",
};

/** Profil de generation pour un test : seul le nom est obligatoire. */
export function buildProfile(
  over: Partial<GenerationProfile> & Pick<GenerationProfile, "name">
): GenerationProfile {
  const rules = over.rules ?? [];
  return {
    id: uuid(),
    description: null,
    isDefault: false,
    cooldownDays: 3,
    useIdeas: true,
    grid: [],
    ...over,
    rules,
    ruleCount: rules.length,
  };
}

interface ProfileState {
  profiles: GenerationProfile[];
  profilePatches: (UpdateGenerationProfileBody & { profileId: string })[];
  ruleBodies: RuleBody[];
  grids: PutGridBody[];
  deletedProfiles: { id: string; defaultId?: string }[];
}

/** Profils, regles et grille, avec l'etat garde dans `state`. */
function profileHandlers(base: string, state: ProfileState, tags: readonly Tag[]) {
  const url = `${base}/profiles`;
  const find = (id: unknown) => state.profiles.find((p) => p.id === id);
  const summary = (p: GenerationProfile) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault,
    ruleCount: p.rules.length,
  });
  const save = (profile: GenerationProfile) => {
    const saved = { ...profile, ruleCount: profile.rules.length };
    state.profiles = state.profiles.map((p) => (p.id === saved.id ? saved : p));
    return saved;
  };
  const tagOf = (id: string) => {
    const tag = tags.find((t) => t.id === id);
    return { id, name: tag?.name ?? "?", status: "ACTIVE" as const };
  };
  const toRule = (body: RuleBody, id = uuid()): Rule => {
    const bounded = (body.frequencyMin ?? null) !== null || (body.frequencyMax ?? null) !== null;
    return {
      id,
      target:
        body.target.kind === "TAG"
          ? { kind: "TAG", tag: tagOf(body.target.tagId) }
          : { kind: "RECIPE", recipe: { id: body.target.recipeId, title: "Recette" } },
      weight: body.weight ?? 1,
      mealTime: body.mealTime ?? null,
      frequencyMin: body.frequencyMin ?? null,
      frequencyMax: body.frequencyMax ?? null,
      frequencyPer: bounded ? (body.frequencyPer ?? "PER_WEEK") : null,
      tagCooldownDays: body.tagCooldownDays ?? null,
    };
  };
  return [
    http.get(url, () =>
      HttpResponse.json({
        data: [...state.profiles]
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
          .map(summary),
      })
    ),
    http.post(url, async ({ request }) => {
      const body = (await request.json()) as { name: string };
      const profile = buildProfile({ name: body.name });
      state.profiles.push(profile);
      return HttpResponse.json(profile, { status: 201 });
    }),
    http.get(`${url}/:id`, ({ params }) => HttpResponse.json(find(params.id))),
    http.patch(`${url}/:id`, async ({ params, request }) => {
      const body = (await request.json()) as UpdateGenerationProfileBody;
      state.profilePatches.push({ profileId: String(params.id), ...body });
      if (body.isDefault) {
        state.profiles = state.profiles.map((p) => ({ ...p, isDefault: p.id === params.id }));
      }
      const current = find(params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const { isDefault: _default, ...rest } = body;
      return HttpResponse.json(
        save({ ...current, ...rest, description: body.description ?? current.description })
      );
    }),
    http.delete(`${url}/:id`, async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as { defaultId?: string };
      state.deletedProfiles.push({ id: String(params.id), ...body });
      state.profiles = state.profiles
        .filter((p) => p.id !== params.id)
        .map((p) => (p.id === body.defaultId ? { ...p, isDefault: true } : p));
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${url}/:id/duplicate`, ({ params }) => {
      const source = find(params.id);
      if (!source) return new HttpResponse(null, { status: 404 });
      const copy = { ...source, id: uuid(), name: `${source.name} (copie)`, isDefault: false };
      state.profiles.push(copy);
      return HttpResponse.json(copy, { status: 201 });
    }),
    http.put(`${url}/:id/grid`, async ({ params, request }) => {
      const body = (await request.json()) as PutGridBody;
      state.grids.push(body);
      const current = find(params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const grid = body.cells.map((cell): GridCell =>
        cell.state === "EXCLUDED"
          ? { weekday: cell.weekday, mealTime: cell.mealTime, state: "EXCLUDED" }
          : {
              weekday: cell.weekday,
              mealTime: cell.mealTime,
              state: "PINNED",
              tag: tagOf(cell.tagId),
            }
      );
      return HttpResponse.json(save({ ...current, grid }));
    }),
    http.post(`${url}/:id/rules`, async ({ params, request }) => {
      const body = (await request.json()) as RuleBody;
      state.ruleBodies.push(body);
      const current = find(params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const rule = toRule(body);
      save({ ...current, rules: [...current.rules, rule] });
      return HttpResponse.json(rule, { status: 201 });
    }),
    http.put(`${url}/:id/rules/:ruleId`, async ({ params, request }) => {
      const body = (await request.json()) as RuleBody;
      state.ruleBodies.push(body);
      const current = find(params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const rule = toRule(body, String(params.ruleId));
      save({ ...current, rules: current.rules.map((r) => (r.id === rule.id ? rule : r)) });
      return HttpResponse.json(rule);
    }),
    http.delete(`${url}/:id/rules/:ruleId`, ({ params }) => {
      const current = find(params.id);
      if (current) save({ ...current, rules: current.rules.filter((r) => r.id !== params.ruleId) });
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

/** Idee de repas pour un test : seul le nom est obligatoire. */
export function buildIdea(over: Partial<MealIdea> & Pick<MealIdea, "name">): MealIdea {
  return {
    id: uuid(),
    comment: null,
    author: { id: uuid(), username: "lea" },
    createdAt: NOW,
    can: { edit: true, delete: true },
    ...over,
  };
}

/** Recette resumee d'un autre espace (pour "mes recettes"). */
export function recipeElsewhere(title: string): RecipeSummary {
  return toSummary(buildRecipe({ title }));
}
