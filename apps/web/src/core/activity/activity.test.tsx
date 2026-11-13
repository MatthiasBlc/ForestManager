import type { ActivityEvent } from "@fm/shared";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

function buildEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    type: "core.member.joined",
    moduleCode: null,
    actor: { id: crypto.randomUUID(), username: "lea", avatarUrl: null },
    targetType: null,
    targetId: null,
    data: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("fil d'activite (F-SPC-7)", () => {
  it("s'ouvre depuis la navigation de l'espace et liste les evenements par jour", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const pages = [
      [
        buildEvent(),
        buildEvent({ type: "core.module.enabled", data: { moduleCode: "meal-plan" } }),
      ],
      [buildEvent({ type: "core.member.left", actor: null, createdAt: old })],
    ];
    server.use(
      http.get("/api/v1/spaces/:spaceId/activity", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        const index = cursor ? Number(cursor) : 0;
        return HttpResponse.json({
          data: pages[index] ?? [],
          nextCursor: index + 1 < pages.length ? String(index + 1) : null,
        });
      })
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${famille.id}/recipes` });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await user.click(within(nav).getByRole("link", { name: "Activité" }));
    expect(await screen.findByRole("heading", { name: "Activité de Famille" })).toBeInTheDocument();
    const today = screen.getByRole("region", { name: "Aujourd'hui" });
    expect(within(today).getByText("a rejoint l'espace.")).toBeInTheDocument();
    expect(within(today).getByText("a activé le module Planning des repas.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voir plus" }));
    const earlier = await screen.findByRole("region", { name: "Plus tôt" });
    expect(within(earlier).getByText("Un ancien membre")).toBeInTheDocument();
  });

  it("etat vide", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    server.use(
      http.get("/api/v1/spaces/:spaceId/activity", () =>
        HttpResponse.json({ data: [], nextCursor: null })
      )
    );
    renderWithProviders(<App />, { route: `/s/${famille.id}/activity` });
    expect(await screen.findByText("Rien ne s'est encore passé ici.")).toBeInTheDocument();
  });
});
