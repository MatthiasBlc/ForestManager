// Handlers MSW d'une session connectee : /me, /spaces, /spaces/:id, /config.
import { errorBody, type Me, type SpaceDetail } from "@fm/shared";
import { http, HttpResponse } from "msw";

import { buildMe, buildPersonalSpace } from "./fixtures.ts";
import { server } from "./server.ts";

export interface SessionOptions {
  me?: Me | null;
  spaces?: SpaceDetail[];
  email?: boolean;
}

/** Installe une session ; renvoie l'utilisateur et ses espaces (perso en premier). */
export function mockSession({ me = buildMe(), spaces, email = true }: SessionOptions = {}) {
  const all = me ? (spaces ?? [buildPersonalSpace(me)]) : [];
  server.use(
    http.get("/api/v1/config", () => HttpResponse.json({ features: { email } })),
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
    http.get("/api/v1/me/transfers", () => HttpResponse.json({ data: [] }))
  );
  return { me, spaces: all };
}
