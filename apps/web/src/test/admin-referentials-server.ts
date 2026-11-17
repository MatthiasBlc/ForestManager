// API admin simulee des referentiels (C4.3), en plus de la session de mockAdminApi.
import type {
  AdminAisle,
  AdminIngredient,
  AdminIngredientItem,
  AdminTag,
  AdminUnit,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { mockAdminApi } from "./admin-server.ts";
import { server } from "./server.ts";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

export const UNITS: AdminUnit[] = [
  unit(1, "g", "MASS", 1, true, "gramme", "g"),
  unit(2, "kg", "MASS", 1000, true, "kilogramme", "kg"),
  unit(3, "ml", "VOLUME", 1, true, "millilitre", "ml"),
  unit(4, "cl", "VOLUME", 10, true, "centilitre", "cl"),
  unit(5, "l", "VOLUME", 1000, true, "litre", "l"),
  unit(6, "tbsp", "VOLUME", 15, false, "cuillère à soupe", "c. à soupe"),
  unit(7, "piece", "COUNT", null, false, "pièce", "pièce"),
  unit(8, "pinch", "NONE", null, false, "pincée", "pincée"),
];

function unit(
  n: number,
  code: string,
  dimension: AdminUnit["dimension"],
  toBase: number | null,
  metric: boolean,
  name: string,
  abbreviation: string
): AdminUnit {
  return {
    id: id(100 + n),
    code,
    dimension,
    toBase,
    metric,
    fr: { name, namePlural: code === "piece" ? "pièces" : null, abbreviation },
    en: code === "pinch" ? null : { name: code, namePlural: null, abbreviation: code },
  };
}

export const AISLES: AdminAisle[] = [
  {
    id: id(201),
    code: "fruits-vegetables",
    fr: "Fruits et légumes",
    en: "Produce",
    ingredientCount: 96,
  },
  { id: id(202), code: "bakery", fr: "Boulangerie", en: "Bakery", ingredientCount: 11 },
  { id: id(203), code: "frozen", fr: "Surgelés", en: null, ingredientCount: 9 },
];

const TARGET: AdminIngredient = {
  id: id(301),
  status: "ACTIVE",
  fr: { name: "tomate cerise", namePlural: "tomates cerises" },
  en: { name: "cherry tomato", namePlural: null },
  aisleId: id(201),
  defaultUnitId: id(107),
  unitWeights: [{ unitId: id(107), grams: 15 }],
  createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
  createdBy: null,
  recipeCount: 7,
  recipes: [],
  synonyms: [],
  mergedInto: null,
  similar: [],
  duplicateOfId: null,
};

const DUPLICATE: AdminIngredient = {
  id: id(302),
  status: "NEW",
  fr: { name: "tomates cerises", namePlural: null },
  en: null,
  aisleId: null,
  defaultUnitId: null,
  unitWeights: [],
  createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  createdBy: "lea",
  recipeCount: 1,
  recipes: [{ id: id(401), title: "Compotée de tomates cerises", author: "lea" }],
  synonyms: [],
  mergedInto: null,
  similar: [
    {
      id: TARGET.id,
      name: "tomate cerise",
      status: "ACTIVE",
      recipeCount: 7,
      aisleId: id(201),
      en: "cherry tomato",
    },
  ],
  duplicateOfId: TARGET.id,
};

const SUMAC: AdminIngredient = {
  ...DUPLICATE,
  id: id(303),
  fr: { name: "sumac", namePlural: null },
  createdBy: "claire",
  recipeCount: 0,
  recipes: [],
  similar: [],
  duplicateOfId: null,
};

function item(ingredient: AdminIngredient): AdminIngredientItem {
  return {
    id: ingredient.id,
    name: ingredient.fr.name,
    status: ingredient.status,
    createdAt: ingredient.createdAt,
    createdBy: ingredient.createdBy,
    recipeCount: ingredient.recipeCount,
    probableDuplicate: ingredient.duplicateOfId !== null,
  };
}

export function mockReferentialsApi() {
  const admin = mockAdminApi();
  const state = {
    calls: [] as { method: string; path: string; body?: unknown }[],
    ingredients: [DUPLICATE, SUMAC, TARGET],
    units: [...UNITS],
    aisles: [...AISLES],
    unclassified: 12,
    tags: [
      { id: id(501), fr: "Végétarien", en: "Vegetarian", recipeCount: 48 },
      { id: id(502), fr: "Apéritif", en: null, recipeCount: 14 },
      { id: id(503), fr: "Rapide", en: "Quick", recipeCount: 61 },
    ] as AdminTag[],
  };
  const record = async (request: Request) => {
    const url = new URL(request.url);
    const body: unknown =
      request.method === "GET" || request.method === "DELETE"
        ? undefined
        : await request.json().catch(() => undefined);
    state.calls.push({ method: request.method, path: url.pathname.replace("/api/v1", ""), body });
    return body as Record<string, unknown>;
  };
  const find = (ingredientId: unknown) => state.ingredients.find((i) => i.id === ingredientId);
  server.use(
    http.get("/api/v1/admin/ingredients", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const tab = params.get("tab");
      const query = (params.get("query") ?? "").toLowerCase();
      const live = state.ingredients.filter((i) => i.status !== "MERGED");
      const inTab = live.filter((i) =>
        tab === "NEW"
          ? i.status === "NEW"
          : tab === "VERIFIED"
            ? i.status === "ACTIVE"
            : tab === "UNTRANSLATED"
              ? i.en === null
              : tab === "NO_AISLE"
                ? i.aisleId === null
                : true
      );
      const data = inTab.filter((i) => i.fr.name.includes(query)).map(item);
      return HttpResponse.json({
        data,
        total: data.length,
        counts: {
          NEW: live.filter((i) => i.status === "NEW").length,
          VERIFIED: live.filter((i) => i.status === "ACTIVE").length,
          UNTRANSLATED: live.filter((i) => i.en === null).length,
          NO_AISLE: live.filter((i) => i.aisleId === null).length,
        },
      });
    }),
    http.get("/api/v1/admin/ingredients/:id", ({ params }) => HttpResponse.json(find(params.id))),
    http.post("/api/v1/admin/ingredients", async ({ request }) => {
      const body = (await record(request)) as { fr: { name: string } };
      const created: AdminIngredient = {
        ...TARGET,
        id: id(399),
        fr: { name: body.fr.name, namePlural: null },
        en: null,
        recipeCount: 0,
      };
      state.ingredients = [...state.ingredients, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put("/api/v1/admin/ingredients/:id", async ({ params, request }) => {
      const body = (await record(request)) as Pick<
        AdminIngredient,
        "fr" | "en" | "aisleId" | "defaultUnitId" | "unitWeights"
      > & { verify: boolean };
      const current = find(params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const updated: AdminIngredient = {
        ...current,
        fr: body.fr,
        en: body.en,
        aisleId: body.aisleId,
        defaultUnitId: body.defaultUnitId,
        unitWeights: body.unitWeights,
        status: body.verify ? "ACTIVE" : current.status,
        duplicateOfId: body.verify ? null : current.duplicateOfId,
      };
      state.ingredients = state.ingredients.map((i) => (i.id === current.id ? updated : i));
      return HttpResponse.json(updated);
    }),
    http.post("/api/v1/admin/ingredients/:id/merge", async ({ params, request }) => {
      const body = (await record(request)) as { intoId: string };
      state.ingredients = state.ingredients.map((i) =>
        i.id === params.id ? { ...i, status: "MERGED" } : i
      );
      return HttpResponse.json(find(body.intoId));
    }),
    http.get("/api/v1/admin/units", () => HttpResponse.json({ data: state.units })),
    http.post("/api/v1/admin/units", async ({ request }) => {
      const body = (await record(request)) as AdminUnit;
      const created = { ...body, id: id(199), en: body.en ?? null };
      state.units = [...state.units, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch("/api/v1/admin/units/:id", async ({ params, request }) => {
      const body = (await record(request)) as Omit<AdminUnit, "id" | "code">;
      const current = state.units.find((u) => u.id === params.id);
      if (!current) return new HttpResponse(null, { status: 404 });
      const updated = { ...current, ...body };
      state.units = state.units.map((u) => (u.id === current.id ? updated : u));
      return HttpResponse.json(updated);
    }),
    http.get("/api/v1/admin/aisles", () =>
      HttpResponse.json({ data: state.aisles, unclassifiedCount: state.unclassified })
    ),
    http.post("/api/v1/admin/aisles", async ({ request }) => {
      const body = (await record(request)) as { fr: string; en: string | null };
      const created = { id: id(299), code: "new", fr: body.fr, en: body.en, ingredientCount: 0 };
      state.aisles = [...state.aisles, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put("/api/v1/admin/aisles/order", async ({ request }) => {
      const body = (await record(request)) as { ids: string[] };
      state.aisles = body.ids.map((aisleId) => state.aisles.find((a) => a.id === aisleId)!);
      return HttpResponse.json({ data: state.aisles, unclassifiedCount: state.unclassified });
    }),
    http.patch("/api/v1/admin/aisles/:id", async ({ params, request }) => {
      const body = (await record(request)) as { fr: string; en: string | null };
      state.aisles = state.aisles.map((a) => (a.id === params.id ? { ...a, ...body } : a));
      return HttpResponse.json(state.aisles.find((a) => a.id === params.id));
    }),
    http.get("/api/v1/admin/tags", () => HttpResponse.json({ data: state.tags })),
    http.post("/api/v1/admin/tags", async ({ request }) => {
      const body = (await record(request)) as { fr: string; en: string | null };
      const created = { id: id(599), fr: body.fr, en: body.en, recipeCount: 0 };
      state.tags = [...state.tags, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch("/api/v1/admin/tags/:id", async ({ params, request }) => {
      const body = (await record(request)) as { fr: string; en: string | null };
      state.tags = state.tags.map((t) => (t.id === params.id ? { ...t, ...body } : t));
      return HttpResponse.json(state.tags.find((t) => t.id === params.id));
    }),
    http.post("/api/v1/admin/tags/:id/merge", async ({ params, request }) => {
      const body = (await record(request)) as { intoTagId: string };
      state.tags = state.tags.filter((t) => t.id !== params.id);
      return HttpResponse.json(state.tags.find((t) => t.id === body.intoTagId));
    }),
    http.delete("/api/v1/admin/tags/:id", async ({ params, request }) => {
      await record(request);
      state.tags = state.tags.filter((t) => t.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { state, admin };
}

export const INGREDIENTS = { TARGET, DUPLICATE, SUMAC };
