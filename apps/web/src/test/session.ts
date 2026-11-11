// Handlers MSW d'une session connectee : /me, /spaces, /spaces/:id, /config, et
// un module Recettes vide (page d'arrivee d'un espace).
import { errorBody, type Me, type SpaceDetail } from "@fm/shared";
import { http, HttpResponse } from "msw";

import { buildMe, buildPersonalSpace, UNITS } from "./fixtures.ts";
import { server } from "./server.ts";

export interface SessionOptions {
  me?: Me | null;
  spaces?: SpaceDetail[];
  email?: boolean;
  /** Envoi de photos [D167] : coupe par defaut (aucun choix de photo affiche). */
  uploads?: boolean;
}

/** Installe une session ; renvoie l'utilisateur et ses espaces (perso en premier). */
export function mockSession({
  me = buildMe(),
  spaces,
  email = true,
  uploads = false,
}: SessionOptions = {}) {
  const all = me ? (spaces ?? [buildPersonalSpace(me)]) : [];
  server.use(
    http.get("/api/v1/config", () => HttpResponse.json({ features: { email, uploads } })),
    http.get("/api/v1/me", () =>
      me ? HttpResponse.json(me) : HttpResponse.json(errorBody("AUTH_001"), { status: 401 })
    ),
    http.get("/api/v1/spaces", () =>
      me
        ? HttpResponse.json({ data: all.map(({ modules: _modules, ...summary }) => summary) })
        : HttpResponse.json(errorBody("AUTH_001"), { status: 401 })
    ),
    http.get("/api/v1/spaces/:spaceId", ({ params }) => {
      const space = all.find((s) => s.id === params.spaceId);
      return space
        ? HttpResponse.json(space)
        : HttpResponse.json(errorBody("SPACE_001"), { status: 404 });
    }),
    http.get("/api/v1/me/invitations", () => HttpResponse.json({ data: [] })),
    http.get("/api/v1/me/transfers", () => HttpResponse.json({ data: [] })),
    http.get("/api/v1/me/notifications/unread-count", () => HttpResponse.json({ count: 0 })),
    http.get("/api/v1/me/home", () =>
      HttpResponse.json({ widgets: [], available: [], custom: false })
    )
  );
  mockEmptyRecipes();
  return { me, spaces: all };
}

/** Module Recettes vide : referentiels, liste, demandes et apercu de depart vides dans tout espace. */
export function mockEmptyRecipes(): void {
  server.use(
    http.get("/api/v1/units", () => HttpResponse.json({ data: UNITS })),
    http.get("/api/v1/tags", () => HttpResponse.json({ data: [] })),
    http.get("/api/v1/spaces/:spaceId/recipes/tags", () => HttpResponse.json({ data: [] })),
    http.get("/api/v1/spaces/:spaceId/recipes/share-requests", () =>
      HttpResponse.json({ data: [] })
    ),
    http.get("/api/v1/spaces/:spaceId/recipes/suggestions", () => HttpResponse.json({ data: [] })),
    http.get("/api/v1/spaces/:spaceId/recipes/mine", () =>
      HttpResponse.json({ data: [], nextCursor: null })
    ),
    http.get("/api/v1/spaces/:spaceId/recipes/leave-preview", () =>
      HttpResponse.json({ createdHere: 0, personalShared: [] })
    ),
    http.get("/api/v1/spaces/:spaceId/recipes", () =>
      HttpResponse.json({ data: [], nextCursor: null })
    )
  );
}
