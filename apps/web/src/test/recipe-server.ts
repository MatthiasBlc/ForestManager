// Faux serveur du module Recettes (MSW) sur un espace groupe : referentiels,
// liste, detail, creation, modification, suppression, historique, restauration,
// partage (F-PARTAGER, demandes, "Mes recettes", depart). Garde l'etat et les corps recus.
import {
  errorBody,
  type CreateRecipeBody,
  type Ingredient,
  type Recipe,
  type RecipeBlock,
  type RecipeComparison,
  type RecipeLeavePreview,
  type RecipeRevision,
  type RecipeSharing,
  type RestoreRevisionBody,
  type ShareRequest,
  type Suggestion,
  type ShareStatus,
  type SpaceDetail,
  type SpaceRole,
  type Tag,
  type UpdateRecipeBody,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import {
  buildRecipe,
  buildSuggestion,
  toSummary,
  UNITS,
  uuid,
  type RecipeOverrides,
} from "./fixtures.ts";
import { server } from "./server.ts";
import { spaceServer } from "./space-server.ts";

const ingredient = (name: string): Ingredient => ({
  id: uuid(),
  name,
  namePlural: null,
  defaultUnitId: null,
  matchedName: null,
});

export function recipeServer({
  myRole = "MEMBER",
  recipes = [],
  revisions = {},
  extraSpaces = [],
}: {
  myRole?: SpaceRole;
  recipes?: Recipe[];
  /** Historique par recette, du plus recent au plus ancien. */
  revisions?: Record<string, RecipeRevision[]>;
  extraSpaces?: SpaceDetail[];
} = {}) {
  const s = spaceServer({ myRole, extraSpaces });
  const state = {
    // Recettes donnees : nees dans l'espace groupe (une autre origine passe par `add`).
    recipes: recipes.map((r) => ({
      ...r,
      homeSpaceId: s.space.id,
      homeSpace: { id: s.space.id, name: s.space.name },
    })),
    revisions: { ...revisions },
    ingredients: [ingredient("Pâtes"), ingredient("Pâtes fraîches"), ingredient("Crème fraîche")],
    globalTags: [
      { id: uuid(), scope: "GLOBAL", name: "Végétarien" },
      { id: uuid(), scope: "GLOBAL", name: "Rapide" },
    ] as Tag[],
    spaceTags: [{ id: uuid(), scope: "SPACE", name: "Plat du dimanche" }] as Tag[],
    /** Etat du partage par recette ; par defaut, aucun partage. */
    sharing: {} as Record<string, Partial<RecipeSharing>>,
    shareRequests: [] as ShareRequest[],
    /** Reponse a une demande de partage (POST share-requests). */
    requestResult: "PENDING" as ShareStatus,
    leavePreview: { createdHere: 0, personalShared: [] } as RecipeLeavePreview,
    /** Comparaison avec l'original, par adaptation (E-COMPARER-ORIGINAL). */
    comparisons: {} as Record<string, RecipeComparison>,
    suggestions: [] as Suggestion[],
    queries: [] as URLSearchParams[],
    bodies: {} as Record<string, unknown>,
    calls: [] as string[],
  };
  const base = `/api/v1/spaces/${s.space.id}/recipes`;
  const self = { id: s.me.id, username: s.me.username, avatarUrl: null };

  const find = (id: unknown) => state.recipes.find((r) => r.id === id);

  function fromBody(body: CreateRecipeBody, current?: Recipe): Recipe {
    const tags = [...state.globalTags, ...state.spaceTags].filter(
      (tag) =>
        (body.globalTagIds ?? []).includes(tag.id) || (body.spaceTagIds ?? []).includes(tag.id)
    );
    return buildRecipe({
      ...(current ?? { id: uuid(), author: self }),
      homeSpaceId: s.space.id,
      homeSpace: { id: s.space.id, name: s.space.name },
      title: body.title,
      yieldQuantity: body.yieldQuantity,
      prepMinutes: body.prepMinutes ?? null,
      cookMinutes: body.cookMinutes ?? null,
      restMinutes: body.restMinutes ?? null,
      totalMinutes: (body.prepMinutes ?? 0) + (body.cookMinutes ?? 0) || null,
      notes: body.notes ?? null,
      isBase: body.isBase ?? false,
      tags,
      currentRevision: (current?.currentRevision ?? 0) + 1,
      blocks: body.blocks.map((block): RecipeBlock => {
        if (block.kind === "RECIPE") {
          const sub = find(block.recipeId);
          return {
            ...block,
            status: sub ? "AVAILABLE" : "DELETED",
            recipe: sub
              ? {
                  id: sub.id,
                  title: sub.title,
                  yieldQuantity: sub.yieldQuantity,
                  yieldUnitId: sub.yieldUnitId,
                  isBase: sub.isBase,
                  blocks: sub.blocks,
                }
              : null,
          };
        }
        return {
          kind: "LOCAL",
          title: block.title ?? null,
          steps: block.steps,
          ingredients: block.ingredients.map((line) => ({
            ingredientId: line.ingredientId,
            name: state.ingredients.find((i) => i.id === line.ingredientId)?.name ?? "?",
            namePlural: null,
            quantity: line.quantity,
            unitId: line.unitId,
            note: line.note ?? null,
            optional: line.optional ?? false,
          })),
        };
      }),
      ...(current ? { can: current.can } : {}),
    });
  }

  const notFound = () => HttpResponse.json(errorBody("RECIPE_001"), { status: 404 });

  server.use(
    http.get("/api/v1/units", () => HttpResponse.json({ data: UNITS })),
    http.get("/api/v1/tags", () => HttpResponse.json({ data: state.globalTags })),
    http.get("/api/v1/ingredients", ({ request }) => {
      const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
      return HttpResponse.json({
        data: state.ingredients.filter((i) => i.name.toLowerCase().startsWith(q)),
      });
    }),
    http.post("/api/v1/ingredients", async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      state.calls.push(`ingredient:${name}`);
      const existing = state.ingredients.find((i) => i.name.toLowerCase() === name.toLowerCase());
      if (existing) return HttpResponse.json(existing);
      const created = ingredient(name);
      state.ingredients.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.get(`${base}/tags`, () => HttpResponse.json({ data: state.spaceTags })),
    http.post(`${base}/tags`, async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      const tag: Tag = { id: uuid(), scope: "SPACE", name };
      state.spaceTags.push(tag);
      return HttpResponse.json(tag, { status: 201 });
    }),
    http.get(base, ({ request }) => {
      const params = new URL(request.url).searchParams;
      state.queries.push(params);
      const q = (params.get("q") ?? "").toLowerCase();
      const tagIds = params.get("tagIds")?.split(",") ?? [];
      const data = state.recipes
        .filter((r) => r.title.toLowerCase().includes(q))
        .filter((r) => tagIds.every((id) => r.tags.some((t) => t.id === id)))
        .filter((r) => params.get("base") !== "true" || r.isBase)
        .map(toSummary);
      return HttpResponse.json({ data, nextCursor: null });
    }),
    http.post(base, async ({ request }) => {
      const body = (await request.json()) as CreateRecipeBody;
      state.bodies.create = body;
      const recipe = fromBody(body);
      state.recipes.unshift(recipe);
      return HttpResponse.json(recipe, { status: 201 });
    }),
    http.get(`${base}/:recipeId`, ({ params }) => {
      const recipe = find(params.recipeId);
      return recipe ? HttpResponse.json(recipe) : notFound();
    }),
    http.put(`${base}/:recipeId`, async ({ params, request }) => {
      const current = find(params.recipeId);
      if (!current) return notFound();
      const body = (await request.json()) as UpdateRecipeBody;
      state.bodies.update = body;
      if (body.revision !== current.currentRevision) {
        return HttpResponse.json(errorBody("RECIPE_004"), { status: 409 });
      }
      const { revision: _revision, ...content } = body;
      const updated = fromBody(content, current);
      state.recipes = state.recipes.map((r) => (r.id === current.id ? updated : r));
      return HttpResponse.json(updated);
    }),
    http.get(`${base}/:recipeId/revisions`, ({ params }) => {
      if (!find(params.recipeId)) return notFound();
      return HttpResponse.json({ data: state.revisions[String(params.recipeId)] ?? [] });
    }),
    // Restaurer : la recette passe a la revision suivante, titre suffixe pour le reconnaitre.
    http.post(`${base}/:recipeId/revisions/:number/restore`, async ({ params, request }) => {
      const current = find(params.recipeId);
      if (!current) return notFound();
      const body = (await request.json()) as RestoreRevisionBody;
      state.bodies.restore = { number: Number(params.number), ...body };
      if (body.revision !== current.currentRevision) {
        return HttpResponse.json(errorBody("RECIPE_004"), { status: 409 });
      }
      const restored = {
        ...current,
        title: `${current.title} (r${String(params.number)})`,
        currentRevision: current.currentRevision + 1,
      };
      state.recipes = state.recipes.map((r) => (r.id === current.id ? restored : r));
      return HttpResponse.json(restored);
    }),
    http.delete(`${base}/:recipeId`, ({ params }) => {
      if (!find(params.recipeId)) return notFound();
      state.calls.push(`delete:${String(params.recipeId)}`);
      state.recipes = state.recipes.filter((r) => r.id !== params.recipeId);
      return new HttpResponse(null, { status: 204 });
    })
  );
  const sharingOf = (recipe: Recipe): RecipeSharing => ({
    homeSpace: recipe.homeSpace,
    canShare: recipe.can.share,
    spaces: [],
    withIt: [],
    ...state.sharing[recipe.id],
  });
  const summary = ({
    currentRevision: _c,
    proposed: _p,
    current: _cu,
    result: _r,
    conflicts: _co,
    can: _can,
    ...rest
  }: Suggestion) => rest;
  const record = (name: string, body?: unknown) => {
    // Meme journal que le faux serveur d'espace : l'ordre des appels se lit d'un coup.
    s.state.calls.push(name);
    if (body !== undefined) state.bodies[name] = body;
  };

  // Ajoutes apres coup : passent avant `${base}/:recipeId`.
  server.use(
    // Detail dans n'importe quel espace (adaptation creee ailleurs) ; sinon handler suivant.
    http.get("/api/v1/spaces/:spaceId/recipes/:recipeId", ({ params }) => {
      const recipe = find(params.recipeId);
      return recipe && recipe.homeSpaceId === params.spaceId
        ? HttpResponse.json(recipe)
        : undefined;
    }),
    http.get("/api/v1/spaces/:spaceId/recipes/suggestions", () =>
      HttpResponse.json({
        data: state.suggestions.filter((x) => x.status === "PENDING" && x.can.decide).map(summary),
      })
    ),
    http.get(`${base}/:recipeId/suggestions`, ({ params }) =>
      HttpResponse.json({
        data: state.suggestions
          .filter((x) => x.recipe.id === params.recipeId)
          .filter((x) => x.status === "PENDING" || x.proposer.id === s.me.id)
          .map(summary),
      })
    ),
    http.post(`${base}/:recipeId/suggestions`, async ({ params, request }) => {
      const recipe = find(params.recipeId);
      if (!recipe) return notFound();
      const body = (await request.json()) as Record<string, unknown>;
      record("suggest", body);
      const created = buildSuggestion(recipe, {
        proposer: self,
        can: { decide: false, withdraw: true, convert: false },
      });
      state.suggestions.push(created);
      return HttpResponse.json(summary(created), { status: 201 });
    }),
    http.get(`${base}/:recipeId/suggestions/:suggestionId`, ({ params }) => {
      const found = state.suggestions.find((x) => x.id === params.suggestionId);
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json(errorBody("RECIPE_014"), { status: 404 });
    }),
    http.post(
      `${base}/:recipeId/suggestions/:suggestionId/:action`,
      async ({ params, request }) => {
        const found = state.suggestions.find((x) => x.id === params.suggestionId);
        if (!found) return HttpResponse.json(errorBody("RECIPE_014"), { status: 404 });
        const action = String(params.action);
        const text = await request.text();
        record(action, text ? JSON.parse(text) : {});
        const status = {
          accept: "ACCEPTED",
          reject: "REJECTED",
          withdraw: "WITHDRAWN",
          convert: "CONVERTED",
        }[action];
        if (status) found.status = status as Suggestion["status"];
        const recipe = find(params.recipeId);
        if (action === "accept" && recipe) {
          const updated = {
            ...recipe,
            cookMinutes: 40,
            currentRevision: recipe.currentRevision + 1,
          };
          state.recipes = state.recipes.map((r) => (r.id === recipe.id ? updated : r));
          return HttpResponse.json(updated);
        }
        if (action === "convert" && recipe) {
          const { targetSpaceId } = JSON.parse(text) as { targetSpaceId: string };
          const adaptation = buildRecipe({
            ...recipe,
            id: uuid(),
            author: self,
            homeSpaceId: targetSpaceId,
            homeSpace: { id: targetSpaceId, name: "?" },
            can: { edit: true, delete: true, share: true, removeFromSpace: false },
          });
          state.recipes.push(adaptation);
          return HttpResponse.json(adaptation, { status: 201 });
        }
        return new HttpResponse(null, { status: 204 });
      }
    ),
    http.post(`${base}/:recipeId/adapt`, async ({ params, request }) => {
      const original = find(params.recipeId);
      if (!original) return notFound();
      const body = (await request.json()) as { targetSpaceId: string };
      record("adapt", body);
      const adaptation = buildRecipe({
        ...original,
        id: uuid(),
        author: self,
        homeSpaceId: body.targetSpaceId,
        homeSpace: { id: body.targetSpaceId, name: "?" },
        currentRevision: 1,
        // Droits de l'auteur de l'adaptation, comme l'API.
        can: { edit: true, delete: true, share: true, removeFromSpace: false },
        adaptedFrom: {
          id: original.id,
          title: original.title,
          author: original.author,
          homeSpace: original.homeSpace,
          deleted: false,
          changed: false,
        },
      });
      state.recipes.push(adaptation);
      return HttpResponse.json(adaptation, { status: 201 });
    }),
    http.get(`${base}/:recipeId/compare`, ({ params }) => {
      const comparison = state.comparisons[String(params.recipeId)];
      return comparison
        ? HttpResponse.json(comparison)
        : HttpResponse.json(errorBody("RECIPE_011"), { status: 404 });
    }),
    http.post(`${base}/:recipeId/compare/seen`, ({ params }) => {
      record(`seen:${String(params.recipeId)}`);
      const recipe = find(params.recipeId);
      if (recipe?.adaptedFrom) recipe.adaptedFrom = { ...recipe.adaptedFrom, changed: false };
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("/api/v1/spaces/:spaceId/recipes/mine", ({ request }) => {
      state.queries.push(new URL(request.url).searchParams);
      const data = state.recipes.filter((r) => r.author.id === s.me.id).map(toSummary);
      return HttpResponse.json({ data, nextCursor: null });
    }),
    http.get("/api/v1/spaces/:spaceId/recipes/share-requests", () =>
      HttpResponse.json({ data: state.shareRequests })
    ),
    http.post(
      "/api/v1/spaces/:spaceId/recipes/share-requests/:requestId/:decision",
      async ({ params, request }) => {
        const decision = String(params.decision);
        const text = await request.text();
        record(`${decision}:${String(params.requestId)}`, text ? JSON.parse(text) : {});
        state.shareRequests = state.shareRequests.filter((r) => r.id !== params.requestId);
        return new HttpResponse(null, { status: 204 });
      }
    ),
    http.get(`${base}/leave-preview`, () => HttpResponse.json(state.leavePreview)),
    http.get(`${base}/:recipeId/sharing`, ({ params }) => {
      const recipe = find(params.recipeId);
      return recipe ? HttpResponse.json(sharingOf(recipe)) : notFound();
    }),
    http.put(`${base}/:recipeId/shares`, async ({ params, request }) => {
      const recipe = find(params.recipeId);
      if (!recipe) return notFound();
      const body = (await request.json()) as { spaceIds: string[] };
      record("shares", body);
      state.sharing[recipe.id] = {
        ...state.sharing[recipe.id],
        spaces: body.spaceIds.map((spaceId) => ({ spaceId, status: "SHARED" as const })),
      };
      return HttpResponse.json(sharingOf(recipe));
    }),
    http.post(`${base}/:recipeId/share-requests`, async ({ params, request }) => {
      if (!find(params.recipeId)) return notFound();
      record("shareRequest", await request.json());
      return HttpResponse.json({ status: state.requestResult }, { status: 201 });
    }),
    http.delete(`${base}/:recipeId/share`, ({ params }) => {
      if (!find(params.recipeId)) return notFound();
      record(`unshare:${String(params.recipeId)}`);
      state.recipes = state.recipes.filter((r) => r.id !== params.recipeId);
      return new HttpResponse(null, { status: 204 });
    })
  );

  /** Ajoute une recette de l'utilisateur courant, nee dans l'espace groupe par defaut. */
  function add(over: RecipeOverrides = {}): Recipe {
    const homeSpaceId = over.homeSpaceId ?? s.space.id;
    const home =
      homeSpaceId === s.space.id
        ? { id: s.space.id, name: s.space.name }
        : homeSpaceId === s.personal.id
          ? { id: s.personal.id, name: s.personal.name }
          : { id: homeSpaceId, name: "Foyer" };
    const recipe = buildRecipe({ author: self, homeSpace: home, ...over, homeSpaceId });
    state.recipes.push(recipe);
    return recipe;
  }

  return { ...s, recipes: state, base, add };
}
