import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

/** Faux EventSource : garde les instances, emet les evenements a la demande. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data?: unknown) {
    const event = new MessageEvent(type, { data: data === undefined ? "" : JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("temps reel (SSE, D188)", () => {
  it("ouvre le flux une fois connecte et relit le compteur a chaque notification", async () => {
    const me = buildMe();
    mockSession({ me });
    let count = 0;
    server.use(
      http.get("/api/v1/me/notifications/unread-count", () => HttpResponse.json({ count }))
    );
    renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    await screen.findByRole("button", { name: "Notifications" });
    const source = FakeEventSource.instances[0];
    expect(source?.url).toBe("/api/v1/events");
    count = 3;
    source?.emit("notification", { type: "notification" });
    expect(
      await screen.findByRole("button", { name: "Notifications, 3 non lues" })
    ).toBeInTheDocument();
  });

  it("relit les donnees de l'espace touche par un autre membre", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    let name = "Famille";
    server.use(
      http.get("/api/v1/spaces/:spaceId", ({ params }) =>
        params.spaceId === famille.id
          ? HttpResponse.json({ ...famille, name })
          : HttpResponse.json(buildPersonalSpace(me))
      )
    );
    renderWithProviders(<App />, { route: `/s/${famille.id}/home` });
    expect((await screen.findAllByText("Famille")).length).toBeGreaterThan(0);
    name = "Famille B";
    FakeEventSource.instances[0]?.emit("invalidate", {
      type: "invalidate",
      spaceId: famille.id,
      module: null,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Famille B").length).toBeGreaterThan(0);
    });
  });

  it("ferme le flux a la deconnexion ; pas de flux sans session", async () => {
    mockSession({ me: null });
    renderWithProviders(<App />, { route: "/login" });
    await screen.findByRole("button", { name: "Se connecter" });
    expect(FakeEventSource.instances).toEqual([]);
  });
});
