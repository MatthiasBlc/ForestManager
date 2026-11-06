// API admin simulee pour les tests des ecrans d'administration (session ouverte).
import {
  errorBody,
  type AdminMe,
  type AdminModule,
  type AdminModuleGrant,
  type AdminModuleRequest,
  type SpaceLookupItem,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { server } from "./server.ts";

export const TEST_ADMIN: AdminMe = {
  id: "7c1e7a5e-2c1b-4f55-9b0e-1d2a3b4c5d6e",
  username: "root_admin",
  email: "root@forest.local",
  sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

const COLLOC = { id: "1a1a1a1a-1111-4111-8111-111111111111", name: "Colloc", tintIndex: 2 };
const FOYER = { id: "2b2b2b2b-2222-4222-8222-222222222222", name: "Foyer", tintIndex: 5 };
const SKI = { id: "3c3c3c3c-3333-4333-8333-333333333333", name: "Vacances au ski", tintIndex: 4 };

export function buildModuleRequest(
  overrides: Partial<AdminModuleRequest> = {}
): AdminModuleRequest {
  return {
    id: "9d9d9d9d-9999-4999-8999-999999999999",
    moduleCode: "meal-plan",
    status: "PENDING",
    message: "On voudrait organiser les repas de la semaine.",
    decisionNote: null,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    decidedAt: null,
    space: COLLOC,
    requestedBy: { username: "matthias" },
    ...overrides,
  };
}

/** Session admin ouverte et donnees des modules, modifiees par les appels. */
export function mockAdminApi() {
  const state = {
    requests: [buildModuleRequest()],
    modules: [
      {
        code: "recipes",
        status: "AVAILABLE",
        isDefault: true,
        sortOrder: 1,
        grantedCount: 43,
        enabledCount: 43,
        pendingCount: 0,
      },
      {
        code: "meal-plan",
        status: "BETA",
        isDefault: false,
        sortOrder: 2,
        grantedCount: 1,
        enabledCount: 0,
        pendingCount: 1,
      },
      {
        code: "shopping",
        status: "COMING_SOON",
        isDefault: false,
        sortOrder: 3,
        grantedCount: 0,
        enabledCount: 0,
        pendingCount: 0,
      },
    ] as AdminModule[],
    grants: [
      { space: FOYER, grantedAt: new Date().toISOString(), byAdmin: true, enabled: false },
    ] as AdminModuleGrant[],
    calls: [] as string[],
  };
  const lookup: SpaceLookupItem[] = [{ ...SKI, ownerUsername: "paul" }];
  server.use(
    http.get("/api/v1/config", () =>
      HttpResponse.json({ features: { email: true, uploads: false } })
    ),
    http.get("/api/v1/me", () => HttpResponse.json(errorBody("AUTH_001"), { status: 401 })),
    http.get("/api/v1/admin/me", () => HttpResponse.json(TEST_ADMIN)),
    http.get("/api/v1/admin/module-requests", () =>
      HttpResponse.json({
        pending: state.requests.filter((r) => r.status === "PENDING"),
        recent: state.requests.filter((r) => r.status !== "PENDING"),
      })
    ),
    http.post("/api/v1/admin/module-requests/:id/approve", ({ params }) => {
      state.calls.push(`approve:${String(params.id)}`);
      state.requests = state.requests.map((r) =>
        r.id === params.id ? { ...r, status: "APPROVED", decidedAt: new Date().toISOString() } : r
      );
      return HttpResponse.json(state.requests.find((r) => r.id === params.id));
    }),
    http.post("/api/v1/admin/module-requests/:id/reject", async ({ params, request }) => {
      const { note } = (await request.json()) as { note: string };
      state.calls.push(`reject:${note}`);
      state.requests = state.requests.map((r) =>
        r.id === params.id
          ? { ...r, status: "REJECTED", decisionNote: note, decidedAt: new Date().toISOString() }
          : r
      );
      return HttpResponse.json(state.requests.find((r) => r.id === params.id));
    }),
    http.get("/api/v1/admin/modules", () => HttpResponse.json({ data: state.modules })),
    http.patch("/api/v1/admin/modules/:code", async ({ params, request }) => {
      const { status } = (await request.json()) as { status: AdminModule["status"] };
      state.calls.push(`status:${String(params.code)}:${status}`);
      state.modules = state.modules.map((m) => (m.code === params.code ? { ...m, status } : m));
      return HttpResponse.json(state.modules.find((m) => m.code === params.code));
    }),
    http.get("/api/v1/admin/modules/:code/spaces", () =>
      HttpResponse.json({ data: state.grants, total: state.grants.length })
    ),
    http.post("/api/v1/admin/modules/:code/grants", async ({ params, request }) => {
      const { spaceId } = (await request.json()) as { spaceId: string };
      state.calls.push(`grant:${String(params.code)}:${spaceId}`);
      state.grants = [
        { space: SKI, grantedAt: new Date().toISOString(), byAdmin: true, enabled: false },
        ...state.grants,
      ];
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete("/api/v1/admin/modules/:code/grants/:spaceId", ({ params }) => {
      state.calls.push(`revoke:${String(params.code)}:${String(params.spaceId)}`);
      state.grants = state.grants.filter((g) => g.space.id !== params.spaceId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("/api/v1/admin/spaces/lookup", ({ request }) => {
      const query = new URL(request.url).searchParams.get("query") ?? "";
      return HttpResponse.json({
        data: lookup.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
      });
    })
  );
  return state;
}

export const SPACES = { COLLOC, FOYER, SKI };
