// Faux serveur du module Recettes (MSW) sur un espace groupe : referentiels,
// liste, detail, creation, modification, suppression, historique, restauration. Garde l'etat et les corps recus.
import {
  errorBody,
  type CreateRecipeBody,
  type Ingredient,
  type Recipe,
  type RecipeBlock,
  type RecipeRevision,
  type RestoreRevisionBody,
  type SpaceRole,
  type Tag,
  type UpdateRecipeBody,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { buildRecipe, toSummary, UNITS, uuid } from "./fixtures.ts";
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
}: {
  myRole?: SpaceRole;
  recipes?: Recipe[];
  /** Historique par recette, du plus recent au plus ancien. */
  revisions?: Record<string, RecipeRevision[]>;
} = {}) {
  const s = spaceServer({ myRole });
  const state = {
    recipes: [...recipes],
    revisions: { ...revisions },
    ingredients: [ingredient("Pâtes"), ingredient("Pâtes fraîches"), ingredient("Crème fraîche")],
    globalTags: [
      { id: uuid(), scope: "GLOBAL", name: "Végétarien" },
      { id: uuid(), scope: "GLOBAL", name: "Rapide" },
    ] as Tag[],
    spaceTags: [{ id: uuid(), scope: "SPACE", name: "Plat du dimanche" }] as Tag[],
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
      can: current?.can ?? { edit: true, delete: true },
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
  return { ...s, recipes: state, base };
}
