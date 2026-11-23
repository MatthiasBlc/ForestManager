// Faux serveur du module Liste de courses (MSW) sur l'espace groupe de spaceServer :
// module actif, liste (sections, articles, droits), ajout, modification, retrait,
// ordre, Annuler, catalogue d'ingredients. Garde l'etat et les corps recus.
import {
  type ApplyPlanBody,
  type CreateShoppingItemBody,
  type Ingredient,
  type PlanPreview,
  type RestoreShoppingItemsBody,
  type ShoppingItem,
  type ShoppingRights,
  type ShoppingSection,
  type SpaceRole,
  type UpdateShoppingItemBody,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { NOW, uuid } from "./fixtures.ts";
import { mealPlanServer } from "./meal-plan-server.ts";
import { server } from "./server.ts";
import { spaceServer } from "./space-server.ts";

const RANK = { MEMBER: 0, MODERATOR: 1, OWNER: 2 } as const;

export function buildSection(name: string, over: Partial<ShoppingSection> = {}): ShoppingSection {
  return { id: uuid(), name, aisleId: null, ...over };
}

export function buildIngredient(name: string, over: Partial<Ingredient> = {}): Ingredient {
  return { id: uuid(), name, namePlural: null, defaultUnitId: null, matchedName: null, ...over };
}

/** Article pour un test : un libelle ou un ingredient, rien d'autre d'obligatoire. */
export function buildItem(over: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: uuid(),
    sectionId: null,
    ingredient: null,
    label: null,
    parts: [],
    sortOrder: 0,
    checkedAt: null,
    checkedBy: null,
    sources: [],
    ...over,
  };
}

export function shoppingServer({
  myRole = "MEMBER",
  editRole = "MEMBER",
  sections = [],
  items = [],
  catalog = [],
  mealPlan,
  preview = { lines: [], addedMeals: [], skippedMeals: [], missingSubRecipes: [] },
  applyResult,
}: {
  myRole?: SpaceRole;
  editRole?: SpaceRole;
  sections?: ShoppingSection[];
  items?: ShoppingItem[];
  /** Ingredients du catalogue (suggestions du champ d'ajout). */
  catalog?: Ingredient[];
  /** Module planning actif aussi (faux serveur du planning, meme espace). */
  mealPlan?: Omit<NonNullable<Parameters<typeof mealPlanServer>[0]>, "myRole">;
  /** Reponse de l'apercu "Depuis le planning". */
  preview?: PlanPreview;
  /** Reponse de l'ajout ; par defaut, une ligne ajoutee par ingredient coche. */
  applyResult?: { added: number; updated: number };
} = {}) {
  const s = mealPlan ? mealPlanServer({ ...mealPlan, myRole }) : spaceServer({ myRole });
  s.space.modules = [
    { code: "recipes", sortOrder: 0 },
    ...(mealPlan ? [{ code: "meal-plan", sortOrder: 1 }] : []),
    { code: "shopping", sortOrder: 2 },
  ];
  const state = {
    editRole,
    sections: [...sections],
    items: [...items],
    created: [] as CreateShoppingItemBody[],
    patches: [] as (UpdateShoppingItemBody & { itemId: string })[],
    deleted: [] as string[],
    orders: [] as { sectionId: string | null; ids: string[] }[],
    restored: [] as RestoreShoppingItemsBody[],
    /** Periodes demandees a l'apercu, et ajouts depuis le planning. */
    previews: [] as { from: string; to: string }[],
    applied: [] as ApplyPlanBody[],
  };
  const can = (): ShoppingRights => ({
    edit: RANK[myRole] >= RANK[state.editRole],
    setEditRole: myRole === "OWNER",
  });
  const base = `/api/v1/spaces/${s.space.id}/shopping`;
  const lastOrder = (sectionId: string | null) =>
    Math.max(-1, ...state.items.filter((i) => i.sectionId === sectionId).map((i) => i.sortOrder));

  server.use(
    http.get(base, () =>
      HttpResponse.json({ sections: state.sections, items: state.items, can: can() })
    ),
    http.get(`${base}/settings`, () => HttpResponse.json({ editRole: state.editRole, can: can() })),
    http.get("/api/v1/ingredients", ({ request }) => {
      const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
      return HttpResponse.json({
        // Proche de la similarite de l'API : "citrons" trouve "citron".
        data: catalog
          .filter((i) => i.name.toLowerCase().includes(q) || q.startsWith(i.name.toLowerCase()))
          .slice(0, 6),
      });
    }),
    http.post(`${base}/from-plan/preview`, async ({ request }) => {
      state.previews.push((await request.json()) as { from: string; to: string });
      return HttpResponse.json(preview);
    }),
    http.post(`${base}/from-plan`, async ({ request }) => {
      const body = (await request.json()) as ApplyPlanBody;
      state.applied.push(body);
      return HttpResponse.json(applyResult ?? { added: body.ingredientIds.length, updated: 0 });
    }),
    http.post(`${base}/items`, async ({ request }) => {
      const body = (await request.json()) as CreateShoppingItemBody;
      state.created.push(body);
      const ingredient = catalog.find((i) => i.id === body.ingredientId) ?? null;
      const item = buildItem({
        ingredient: ingredient
          ? { id: ingredient.id, name: ingredient.name, namePlural: ingredient.namePlural }
          : null,
        label: ingredient ? null : (body.label ?? null),
        parts: body.parts,
        sortOrder: lastOrder(null) + 1,
      });
      state.items.push(item);
      return HttpResponse.json(item, { status: 201 });
    }),
    http.put(`${base}/items/order`, async ({ request }) => {
      const body = (await request.json()) as { sectionId: string | null; ids: string[] };
      state.orders.push(body);
      body.ids.forEach((id, index) => {
        const item = state.items.find((i) => i.id === id);
        if (item) item.sortOrder = index;
      });
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${base}/items/restore`, async ({ request }) => {
      const body = (await request.json()) as RestoreShoppingItemsBody;
      state.restored.push(body);
      const back = body.items.map((i) =>
        buildItem({
          id: i.id,
          sectionId: i.sectionId,
          label: i.label,
          parts: i.parts,
          sortOrder: i.sortOrder,
          checkedAt: i.checkedAt,
        })
      );
      state.items.push(...back);
      return HttpResponse.json({ data: back });
    }),
    http.patch(`${base}/items/:itemId`, async ({ params, request }) => {
      const body = (await request.json()) as UpdateShoppingItemBody;
      const itemId = String(params.itemId);
      state.patches.push({ ...body, itemId });
      const item = state.items.find((i) => i.id === itemId);
      if (!item) return HttpResponse.json({ code: "SHOPPING_001" }, { status: 404 });
      if (body.parts) item.parts = body.parts;
      if (body.checked !== undefined) item.checkedAt = body.checked ? NOW : null;
      if (body.sectionId !== undefined && body.sectionId !== item.sectionId) {
        item.sortOrder = lastOrder(body.sectionId) + 1;
        item.sectionId = body.sectionId;
      }
      return HttpResponse.json(item);
    }),
    http.delete(`${base}/items/:itemId`, ({ params }) => {
      state.deleted.push(String(params.itemId));
      state.items = state.items.filter((i) => i.id !== params.itemId);
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { ...s, shop: state };
}
