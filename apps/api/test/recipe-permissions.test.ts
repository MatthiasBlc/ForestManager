// Matrice B2 du module Recettes, generee depuis le routeur lui-meme (definition
// de fini de C3) : chaque route declare sa permission par requirePermission ;
// un test par route et par acteur, attendu tire du manifeste (role minimal).
// Un acteur autorise doit aussi aboutir (2xx) : le scenario fait de lui l'auteur
// de la recette quand il peut l'etre. Les regles fines (auteur, decideur,
// moderateur de l'espace d'origine) ont leurs tests dans les autres fichiers.
import {
  CORE_PERMISSIONS,
  modulePermissionDefinition,
  type CorePermissionKey,
  type PermissionDefinition,
  type SpaceRole,
} from "@fm/shared";
import type { Router } from "express";
import { pino } from "pino";
import type { Response } from "supertest";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { permissionOf } from "../src/core/modules/guards.ts";
import { MODULES } from "../src/modules/index.ts";
import { recipesModule } from "../src/modules/recipes/manifest.ts";
import { RECIPE_PERMISSIONS } from "../src/modules/recipes/permissions.ts";
import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { createSpace, type createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody } from "./helpers/recipes.ts";
import {
  ACTORS,
  allowedFor,
  clientAs,
  expectPermission,
  groupFixture,
  type GroupFixture,
  type TestActor,
} from "./helpers/roles.ts";
import { upload } from "./helpers/storage.ts";

const NOT_FOUND = "00000000-0000-4000-8000-000000000000";

// Import sans reseau : une page avec une recette JSON-LD.
const app = createTestApp({
  fetchPage: (url) =>
    Promise.resolve({
      url,
      html: `<script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Soupe",
        recipeIngredient: ["1 poireau"],
        recipeInstructions: ["Cuire."],
      })}</script>`,
    }),
});

// --- Routes du routeur Recettes et leur permission ---

interface RouteInfo {
  route: string;
  key: string | undefined;
}

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
}

function routesOf(router: Router): RouteInfo[] {
  return (router.stack as RouteLayer[]).flatMap((layer) => {
    if (!layer.route) return [];
    const { path, methods, stack } = layer.route;
    const key = stack.map((l) => permissionOf(l.handle)).find((k) => k !== undefined);
    return Object.keys(methods).map((method) => ({
      route: `${method.toUpperCase()} ${path}`,
      key,
    }));
  });
}

const ctx = createContext({
  env: testEnv,
  db,
  logger: pino({ level: "silent" }),
  storage: null,
  modules: MODULES,
});
if (!recipesModule.router) throw new Error("recipes module without router");
const ROUTES = routesOf(recipesModule.router(ctx));

// --- Matrice B2 recopiee a la main (12-Permissions.md, Recettes et Tags) ---

type RecipeKey = keyof typeof RECIPE_PERMISSIONS;

/** Role minimal de chaque permission ; aucune n'est reglable par l'OWNER. */
const B2_MIN_ROLE: Record<RecipeKey, SpaceRole> = {
  "recipes.view": "MEMBER",
  "recipes.create": "MEMBER",
  "recipes.moderate": "MODERATOR",
  "recipes.tags.create": "MEMBER",
  "recipes.tags.moderate": "MODERATOR",
};

/** Garde de chaque route : les droits fins (auteur, decideur) sont ceux des services. */
const B2_ROUTES: Record<string, RecipeKey> = {
  "GET /": "recipes.view",
  "POST /import": "recipes.create",
  "POST /": "recipes.create",
  "GET /mine": "recipes.view",
  "POST /add-mine/preview": "recipes.create",
  "POST /add-mine": "recipes.create",
  "GET /share-requests": "recipes.view",
  "POST /share-requests/:requestId/approve": "recipes.view",
  "POST /share-requests/:requestId/reject": "recipes.view",
  "GET /suggestions": "recipes.view",
  "GET /leave-preview": "recipes.view",
  "GET /tags": "recipes.view",
  "POST /tags": "recipes.tags.create",
  "PATCH /tags/:tagId": "recipes.tags.moderate",
  "POST /tags/:tagId/merge": "recipes.tags.moderate",
  "DELETE /tags/:tagId": "recipes.tags.moderate",
  "GET /:recipeId": "recipes.view",
  "PUT /:recipeId": "recipes.view",
  "DELETE /:recipeId": "recipes.view",
  "PUT /:recipeId/photo": "recipes.view",
  "DELETE /:recipeId/photo": "recipes.view",
  "PUT /:recipeId/space-tags": "recipes.tags.create",
  "GET /:recipeId/sharing": "recipes.view",
  "PUT /:recipeId/shares": "recipes.view",
  "POST /:recipeId/share-requests": "recipes.view",
  "DELETE /:recipeId/share": "recipes.view",
  "GET /:recipeId/revisions": "recipes.view",
  "POST /:recipeId/revisions/:number/restore": "recipes.view",
  "GET /:recipeId/suggestions": "recipes.view",
  "POST /:recipeId/suggestions": "recipes.view",
  "GET /:recipeId/suggestions/:suggestionId": "recipes.view",
  "POST /:recipeId/suggestions/:suggestionId/accept": "recipes.view",
  "POST /:recipeId/suggestions/:suggestionId/reject": "recipes.view",
  "POST /:recipeId/suggestions/:suggestionId/withdraw": "recipes.view",
  "POST /:recipeId/suggestions/:suggestionId/convert": "recipes.view",
  "POST /:recipeId/adapt": "recipes.view",
  "GET /:recipeId/compare": "recipes.view",
  "POST /:recipeId/compare/seen": "recipes.view",
};

function definitionOf(key: string): PermissionDefinition {
  if (Object.hasOwn(RECIPE_PERMISSIONS, key)) {
    return modulePermissionDefinition(RECIPE_PERMISSIONS[key as keyof typeof RECIPE_PERMISSIONS]);
  }
  return CORE_PERMISSIONS[key as CorePermissionKey];
}

// --- Scenario : espace groupe, recette dont le sujet est l'auteur ---

type User = Awaited<ReturnType<typeof createUser>>;

interface Scenario {
  f: GroupFixture;
  base: string;
  /** L'acteur s'il est membre, sinon l'OWNER : auteur de `recipeId`. */
  subject: Client;
  subjectUser: User;
  /** Autre membre de l'espace (demandes, suggestions, recettes d'autrui). */
  extra: Client;
  recipeId: string;
}

async function scenario(actor: TestActor): Promise<Scenario> {
  const f = await groupFixture();
  const member = actor !== "anonymous" && actor !== "outsider";
  const subjectUser = { MEMBER: f.member, MODERATOR: f.moderator, OWNER: f.owner }[
    member ? actor : "OWNER"
  ];
  const subject = await loginAs(subjectUser, app);
  const extra = await loginAs(f.extra, app);
  const recipe = await createRecipe(subject, f.spaceId);
  return {
    f,
    base: `/spaces/${f.spaceId}/recipes`,
    subject,
    subjectUser,
    extra,
    recipeId: recipe.id,
  };
}

/** Etape de mise en place : doit reussir. */
function ok(res: Response): Response {
  if (res.status >= 300) throw new Error(`setup: ${res.status} ${JSON.stringify(res.body)}`);
  return res;
}

async function spaceTag(s: Scenario): Promise<string> {
  const owner = await loginAs(s.f.owner, app);
  return ok(await owner.post(`${s.base}/tags`, { name: "Du dimanche" })).body.id as string;
}

/** Demande de partage en attente de `extra`, que le sujet (auteur) tranche. */
async function pendingShareRequest(s: Scenario): Promise<string> {
  const target = await createSpace(s.f.extra.id);
  const res = await s.extra.post(`${s.base}/${s.recipeId}/share-requests`, {
    targetSpaceId: target.id,
  });
  expect(ok(res).body.status).toBe("PENDING");
  return (await db.recipeShareRequest.findFirstOrThrow({ where: { recipeId: s.recipeId } })).id;
}

/** Suggestion de `from` sur la recette `recipeId`. */
async function suggestion(s: Scenario, from: Client, recipeId: string): Promise<string> {
  const body = { ...(await recipeBody(from, { title: "Gratin du soir" })), revision: 1 };
  ok(await from.post(`${s.base}/${recipeId}/suggestions`, body));
  return (await db.recipeSuggestion.findFirstOrThrow({ where: { recipeId } })).id;
}

/** Recette du sujet nee dans son espace perso ("Depuis mes recettes", D203). */
async function personalRecipe(s: Scenario): Promise<string> {
  return (await createRecipe(s.subject, s.subjectUser.personalSpaceId)).id;
}

async function extraRecipe(s: Scenario): Promise<string> {
  return (await createRecipe(s.extra, s.f.spaceId)).id;
}

type Call = (c: Client, s: Scenario) => Promise<Response>;

const CALLS: Record<string, Call> = {
  "GET /": (c, s) => c.get(s.base),
  "POST /import": (c, s) => c.post(`${s.base}/import`, { url: "https://example.org/soupe" }),
  "POST /": async (c, s) => c.post(s.base, await recipeBody(s.subject)),
  "GET /mine": (c, s) => c.get(`${s.base}/mine`),
  "POST /add-mine/preview": async (c, s) =>
    c.post(`${s.base}/add-mine/preview`, { recipeIds: [await personalRecipe(s)] }),
  "POST /add-mine": async (c, s) =>
    c.post(`${s.base}/add-mine`, { recipeIds: [await personalRecipe(s)] }),
  "GET /share-requests": (c, s) => c.get(`${s.base}/share-requests`),
  "POST /share-requests/:requestId/approve": async (c, s) =>
    c.post(`${s.base}/share-requests/${await pendingShareRequest(s)}/approve`, {}),
  "POST /share-requests/:requestId/reject": async (c, s) =>
    c.post(`${s.base}/share-requests/${await pendingShareRequest(s)}/reject`, {}),
  "GET /suggestions": (c, s) => c.get(`${s.base}/suggestions`),
  "GET /leave-preview": (c, s) => c.get(`${s.base}/leave-preview`),
  "GET /tags": (c, s) => c.get(`${s.base}/tags`),
  "POST /tags": (c, s) => c.post(`${s.base}/tags`, { name: "Rapide" }),
  "PATCH /tags/:tagId": async (c, s) =>
    c.patch(`${s.base}/tags/${await spaceTag(s)}`, { name: "Du samedi" }),
  "POST /tags/:tagId/merge": async (c, s) => {
    const owner = await loginAs(s.f.owner, app);
    const into = ok(await owner.post(`${s.base}/tags`, { name: "Week-end" })).body.id;
    return c.post(`${s.base}/tags/${await spaceTag(s)}/merge`, { intoTagId: into });
  },
  "DELETE /tags/:tagId": async (c, s) => c.delete(`${s.base}/tags/${await spaceTag(s)}`),
  "GET /:recipeId": (c, s) => c.get(`${s.base}/${s.recipeId}`),
  "PUT /:recipeId": async (c, s) =>
    c.put(`${s.base}/${s.recipeId}`, { ...(await recipeBody(s.subject)), revision: 1 }),
  "DELETE /:recipeId": (c, s) => c.delete(`${s.base}/${s.recipeId}`),
  "PUT /:recipeId/photo": async (c, s) =>
    c.put(`${s.base}/${s.recipeId}/photo`, { uploadId: await upload(c).catch(() => NOT_FOUND) }),
  "DELETE /:recipeId/photo": (c, s) => c.delete(`${s.base}/${s.recipeId}/photo`),
  "PUT /:recipeId/space-tags": (c, s) =>
    c.put(`${s.base}/${s.recipeId}/space-tags`, { tagIds: [] }),
  "GET /:recipeId/sharing": (c, s) => c.get(`${s.base}/${s.recipeId}/sharing`),
  "PUT /:recipeId/shares": (c, s) => c.put(`${s.base}/${s.recipeId}/shares`, { spaceIds: [] }),
  "POST /:recipeId/share-requests": async (c, s) => {
    const target = await createSpace(s.subjectUser.id);
    return c.post(`${s.base}/${s.recipeId}/share-requests`, { targetSpaceId: target.id });
  },
  "DELETE /:recipeId/share": async (c, s) => {
    // Recette du sujet nee dans un autre de ses espaces, partagee dans celui-ci.
    const home = await createSpace(s.subjectUser.id);
    const recipe = await createRecipe(s.subject, home.id);
    ok(
      await s.subject.put(`/spaces/${home.id}/recipes/${recipe.id}/shares`, {
        spaceIds: [s.f.spaceId],
      })
    );
    return c.delete(`${s.base}/${recipe.id}/share`);
  },
  "GET /:recipeId/revisions": (c, s) => c.get(`${s.base}/${s.recipeId}/revisions`),
  "POST /:recipeId/revisions/:number/restore": async (c, s) => {
    const body = { ...(await recipeBody(s.subject, { title: "Gratin v2" })), revision: 1 };
    ok(await s.subject.put(`${s.base}/${s.recipeId}`, body));
    return c.post(`${s.base}/${s.recipeId}/revisions/1/restore`, { revision: 2 });
  },
  "GET /:recipeId/suggestions": (c, s) => c.get(`${s.base}/${s.recipeId}/suggestions`),
  "POST /:recipeId/suggestions": async (c, s) => {
    const recipeId = await extraRecipe(s);
    return c.post(`${s.base}/${recipeId}/suggestions`, {
      ...(await recipeBody(s.subject, { title: "Gratin du soir" })),
      revision: 1,
    });
  },
  "GET /:recipeId/suggestions/:suggestionId": async (c, s) =>
    c.get(`${s.base}/${s.recipeId}/suggestions/${await suggestion(s, s.extra, s.recipeId)}`),
  "POST /:recipeId/suggestions/:suggestionId/accept": async (c, s) => {
    const id = await suggestion(s, s.extra, s.recipeId);
    return c.post(`${s.base}/${s.recipeId}/suggestions/${id}/accept`, { revision: 1 });
  },
  "POST /:recipeId/suggestions/:suggestionId/reject": async (c, s) => {
    const id = await suggestion(s, s.extra, s.recipeId);
    return c.post(`${s.base}/${s.recipeId}/suggestions/${id}/reject`, {});
  },
  "POST /:recipeId/suggestions/:suggestionId/withdraw": async (c, s) => {
    const recipeId = await extraRecipe(s);
    const id = await suggestion(s, s.subject, recipeId);
    return c.post(`${s.base}/${recipeId}/suggestions/${id}/withdraw`, {});
  },
  "POST /:recipeId/suggestions/:suggestionId/convert": async (c, s) => {
    const recipeId = await extraRecipe(s);
    const id = await suggestion(s, s.subject, recipeId);
    ok(await s.extra.post(`${s.base}/${recipeId}/suggestions/${id}/reject`, {}));
    return c.post(`${s.base}/${recipeId}/suggestions/${id}/convert`, {
      targetSpaceId: s.f.spaceId,
    });
  },
  "POST /:recipeId/adapt": (c, s) =>
    c.post(`${s.base}/${s.recipeId}/adapt`, { targetSpaceId: s.f.spaceId }),
  "GET /:recipeId/compare": async (c, s) => {
    const adaptation = await adapt(s);
    return c.get(`${s.base}/${adaptation}/compare`);
  },
  "POST /:recipeId/compare/seen": async (c, s) => {
    const adaptation = await adapt(s);
    return c.post(`${s.base}/${adaptation}/compare/seen`, {});
  },
};

/** Adaptation, par le sujet, de la recette de `extra`. */
async function adapt(s: Scenario): Promise<string> {
  const original = await extraRecipe(s);
  const res = await s.subject.post(`${s.base}/${original}/adapt`, { targetSpaceId: s.f.spaceId });
  return ok(res).body.id as string;
}

describe("routes du module Recettes", () => {
  it("le manifeste reprend les roles minimaux de la matrice B2", () => {
    expect(RECIPE_PERMISSIONS).toEqual(
      Object.fromEntries(Object.entries(B2_MIN_ROLE).map(([key, minRole]) => [key, { minRole }]))
    );
  });

  it("chaque route est gardee par la permission de la matrice B2", () => {
    expect(Object.fromEntries(ROUTES.map(({ route, key }) => [route, key]))).toEqual(B2_ROUTES);
  });

  it("chaque route a son cas de test", () => {
    expect(Object.keys(CALLS).sort()).toEqual(Object.keys(B2_ROUTES).sort());
  });
});

describe("permissions du module Recettes (matrice B2)", () => {
  for (const { route, key } of ROUTES) {
    const call = CALLS[route];
    if (!key || !call) continue;
    for (const actor of ACTORS) {
      const allowed = allowedFor(actor, definitionOf(key));
      it(`${route} (${key}) - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
        const s = await scenario(actor);
        const client = await clientAs(actor, s.f, app);
        const res = await call(client, s);
        expectPermission(actor, allowed, res);
        if (allowed) expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
      });
    }
  }
});
