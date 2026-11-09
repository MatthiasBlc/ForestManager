// API admin simulee des espaces et de la moderation (C4.5).
import {
  errorBody,
  type AdminSpace,
  type ModerationAccess,
  type ModerationRecipeItem,
  type Recipe,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { UNITS } from "./admin-referentials-server.ts";
import { mockAdminApi } from "./admin-server.ts";
import { buildRecipe } from "./fixtures.ts";
import { server } from "./server.ts";

const space = (over: Partial<AdminSpace>): AdminSpace => ({
  id: "6b6b6b6b-6666-4666-8666-666666666666",
  name: "Famille",
  tintIndex: 1,
  kind: "GROUP",
  owner: "matthias",
  memberCount: 6,
  recipeCount: 58,
  modules: ["recipes", "meal-plan"],
  deletedAt: null,
  purgeAfter: null,
  ...over,
});

export const FAMILLE = space({});
export const VACANCES = space({
  id: "7c7c7c7c-7777-4777-8777-777777777777",
  name: "Vacances 2025",
  owner: "claire",
  memberCount: 7,
  recipeCount: 12,
  modules: ["recipes"],
  deletedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
  purgeAfter: new Date(Date.now() + 12 * 24 * 3600 * 1000 - 60_000).toISOString(),
});

export const SOUPE: Recipe = buildRecipe({ title: "Soupe de Sam" });
export const TARTE: Recipe = buildRecipe({ title: "Tarte partagée" });

export function mockSpacesApi({ access = true } = {}) {
  mockAdminApi();
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const state = {
    access,
    spaces: [FAMILLE, VACANCES],
    recipes: [
      { id: SOUPE.id, title: SOUPE.title, author: "sam", atHome: true, hiddenReason: null },
      { id: TARTE.id, title: TARTE.title, author: "lea", atHome: false, hiddenReason: null },
    ] as ModerationRecipeItem[],
  };
  const record = async (request: Request) => {
    const body: unknown = await request.json().catch(() => undefined);
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname.replace("/api/v1", ""),
      body,
    });
    return body as Record<string, string>;
  };
  const accessOf = (body: Record<string, string>): ModerationAccess => ({
    id: "8d8d8d8d-8888-4888-8888-888888888888",
    spaceId: FAMILLE.id,
    reason: (body.reason ?? "MEMBER_REPORT") as ModerationAccess["reason"],
    note: body.note ?? "Signalement de Sam",
    openedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  const denied = () => HttpResponse.json(errorBody("ADMIN_013"), { status: 403 });
  server.use(
    http.get("/api/v1/admin/units", () => HttpResponse.json({ data: UNITS })),
    http.get("/api/v1/admin/spaces", ({ request }) => {
      const filter = new URL(request.url).searchParams.get("filter") ?? "GROUP";
      const data = state.spaces.filter((s) =>
        filter === "DELETING" ? s.deletedAt !== null : s.deletedAt === null && s.kind === filter
      );
      return HttpResponse.json({
        data,
        total: data.length,
        counts: { GROUP: 9, PERSONAL: 34, DELETING: 1 },
      });
    }),
    http.post("/api/v1/admin/spaces/:id/restore", async ({ request, params }) => {
      await record(request);
      state.spaces = state.spaces.map((s) =>
        s.id === params.id ? { ...s, deletedAt: null, purgeAfter: null } : s
      );
      return HttpResponse.json(state.spaces.find((s) => s.id === params.id));
    }),
    http.post("/api/v1/admin/spaces/:id/moderation", async ({ request }) => {
      const body = await record(request);
      state.access = true;
      return HttpResponse.json(accessOf(body), { status: 201 });
    }),
    http.get("/api/v1/admin/moderation/:spaceId", () =>
      state.access
        ? HttpResponse.json({
            access: accessOf({}),
            space: FAMILLE,
            recipes: state.recipes,
          })
        : denied()
    ),
    http.get("/api/v1/admin/moderation/:spaceId/recipes/:recipeId", ({ params }) =>
      state.access ? HttpResponse.json(params.recipeId === SOUPE.id ? SOUPE : TARTE) : denied()
    ),
    http.post("/api/v1/admin/moderation/:spaceId/close", async ({ request }) => {
      await record(request);
      state.access = false;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/v1/admin/moderation/:spaceId/delete-space", async ({ request }) => {
      await record(request);
      state.access = false;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(
      "/api/v1/admin/moderation/:spaceId/recipes/:recipeId/:action",
      async ({ request, params }) => {
        const body = await record(request);
        const id = String(params.recipeId);
        if (params.action === "hide") {
          state.recipes = state.recipes.map((r) =>
            r.id === id ? { ...r, hiddenReason: body.note ?? "" } : r
          );
        } else if (params.action === "unhide") {
          state.recipes = state.recipes.map((r) =>
            r.id === id ? { ...r, hiddenReason: null } : r
          );
        } else {
          state.recipes = state.recipes.filter((r) => r.id !== id);
        }
        return new HttpResponse(null, { status: 204 });
      }
    )
  );
  return { calls, state };
}
