import type { Notification, NotificationPreferences } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

const LEA = { id: "5f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f", username: "lea", avatarUrl: null };

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: crypto.randomUUID(),
    type: "core.member.joined",
    category: "core.members",
    space: null,
    actor: LEA,
    targetType: null,
    targetId: null,
    data: null,
    count: 1,
    url: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Centre de notifications : pages par curseur, lecture une par une ou toutes. */
function notificationServer(pages: Notification[][]) {
  const calls: string[] = [];
  const all = pages.flat();
  server.use(
    http.get("/api/v1/me/notifications", ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      const index = cursor ? Number(cursor) : 0;
      return HttpResponse.json({
        data: pages[index] ?? [],
        nextCursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
    http.get("/api/v1/me/notifications/unread-count", () =>
      HttpResponse.json({ count: all.filter((n) => !n.readAt).length })
    ),
    http.post("/api/v1/me/notifications/read-all", () => {
      calls.push("read-all");
      for (const n of all) n.readAt ??= new Date().toISOString();
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/v1/me/notifications/:id/read", ({ params }) => {
      calls.push(`read:${String(params.id)}`);
      const found = all.find((n) => n.id === params.id);
      if (found) found.readAt = new Date().toISOString();
      return new HttpResponse(null, { status: 204 });
    })
  );
  return calls;
}

describe("cloche et centre de notifications (P17, F-NOT-1)", () => {
  it("affiche le compteur des non lues dans l'en-tete et ouvre le centre", async () => {
    const me = buildMe();
    mockSession({ me });
    notificationServer([[buildNotification(), buildNotification()]]);
    const { user } = renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    const bell = await screen.findByRole("button", { name: /Notifications/ });
    await waitFor(() => {
      expect(bell).toHaveTextContent("2");
    });
    await user.click(bell);
    expect(await screen.findByRole("heading", { name: "Aujourd'hui" })).toBeInTheDocument();
  });

  it("groupe par jour, ouvre la cible en marquant lu, et regroupe les evenements", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const space = { id: famille.id, name: "Famille", tintIndex: famille.tintIndex };
    const joined = buildNotification({ space, count: 3 });
    const yesterday = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
    const old = buildNotification({
      type: "core.release.published",
      category: "core.releases",
      actor: null,
      data: { version: "2.1.0" },
      createdAt: yesterday,
      readAt: yesterday,
    });
    const unknown = buildNotification({ type: "other.thing", category: "other.cat" });
    const calls = notificationServer([[joined, unknown, old]]);
    server.use(
      http.get("/api/v1/spaces/:spaceId/members", () => HttpResponse.json({ data: [] })),
      http.get("/api/v1/spaces/:spaceId/transfer", () => HttpResponse.json({ transfer: null })),
      http.get("/api/v1/spaces/:spaceId/invitations", () => HttpResponse.json({ data: [] }))
    );
    const { user } = renderWithProviders(<App />, { route: "/notifications" });

    const today = await screen.findByRole("region", { name: "Aujourd'hui" });
    expect(within(today).getByText(/et 2 autres ont rejoint/)).toBeInTheDocument();
    expect(within(today).getByText("Nouvelle notification.")).toBeInTheDocument();
    const earlier = screen.getByRole("region", { name: "Hier" });
    expect(within(earlier).getByText(/La version 2.1.0 est disponible/)).toBeInTheDocument();

    await user.click(within(today).getByRole("link", { name: /ont rejoint Famille/ }));
    await waitFor(() => {
      expect(calls).toEqual([`read:${joined.id}`]);
    });
    expect(await screen.findByRole("heading", { name: "Membres de Famille" })).toBeInTheDocument();
  });

  it("marque tout comme lu, puis le bouton se desactive", async () => {
    mockSession();
    const calls = notificationServer([[buildNotification()]]);
    const { user } = renderWithProviders(<App />, { route: "/notifications" });
    const button = await screen.findByRole("button", { name: "Tout marquer comme lu" });
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    await user.click(button);
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(calls).toEqual(["read-all"]);
  });

  it("charge la suite avec Voir plus ; etat vide sans notification", async () => {
    mockSession();
    notificationServer([
      [buildNotification({ data: { n: 1 } })],
      [buildNotification({ type: "core.member.left" })],
    ]);
    const { user } = renderWithProviders(<App />, { route: "/notifications" });
    await user.click(await screen.findByRole("button", { name: "Voir plus" }));
    expect(await screen.findByText(/a quitté/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus" })).not.toBeInTheDocument();
  });

  it("affiche un etat vide", async () => {
    mockSession();
    notificationServer([[]]);
    renderWithProviders(<App />, { route: "/notifications" });
    expect(await screen.findByText("Aucune notification pour l'instant.")).toBeInTheDocument();
  });
});

describe("preferences de notifications (E-NOTIF-PREFERENCES, F-NOT-2, D118)", () => {
  function preferencesServer(initial: NotificationPreferences) {
    let state = structuredClone(initial);
    const calls: unknown[] = [];
    server.use(
      http.get("/api/v1/me/notification-preferences", () => HttpResponse.json(state)),
      http.put("/api/v1/me/notification-preferences", async ({ request }) => {
        const body = (await request.json()) as { category: string; enabled: boolean };
        calls.push(body);
        state = {
          ...state,
          categories: state.categories.map((c) =>
            c.key === body.category ? { ...c, enabled: body.enabled } : c
          ),
        };
        return HttpResponse.json(state);
      }),
      http.put("/api/v1/me/notification-preferences/spaces/:spaceId", async ({ request }) => {
        const body = (await request.json()) as { categories: Record<string, boolean> };
        calls.push(body);
        state = {
          ...state,
          spaces: state.spaces.map((s) => ({
            ...s,
            custom: true,
            categories: s.categories.map((c) => ({
              ...c,
              enabled: body.categories[c.key] ?? false,
            })),
          })),
        };
        return HttpResponse.json(state);
      }),
      http.delete("/api/v1/me/notification-preferences/spaces/:spaceId", () => {
        calls.push("reset");
        state = { ...state, spaces: state.spaces.map((s) => ({ ...s, custom: false })) };
        return HttpResponse.json(state);
      })
    );
    return calls;
  }

  it("coupe une categorie, puis personnalise un espace et revient aux reglages globaux", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const members = { key: "core.members", moduleCode: null, enabled: true };
    const sharing = { key: "recipes.sharing", moduleCode: "recipes", enabled: true };
    const calls = preferencesServer({
      categories: [members, { key: "core.releases", moduleCode: null, enabled: true }, sharing],
      spaces: [{ spaceId: famille.id, custom: false, categories: [members, sharing] }],
    });
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    await user.click(await screen.findByRole("link", { name: /Notifications/ }));

    const releases = await screen.findByRole("switch", { name: "Nouveautés de Forest Manager" });
    expect(screen.getByText("Une nouvelle version est disponible")).toBeInTheDocument();
    await user.click(releases);
    await waitFor(() => {
      expect(releases).not.toBeChecked();
    });

    const bySpace = screen.getByRole("navigation", { name: "Préférences par espace" });
    const row = within(bySpace).getByRole("button", { name: /Famille/ });
    expect(row).toHaveTextContent("Comme ci-dessus");
    await user.click(row);
    const sheet = await screen.findByRole("dialog", { name: "Famille" });
    await user.click(within(sheet).getByRole("radio", { name: "Personnalisé" }));
    await user.click(within(sheet).getByRole("switch", { name: "Suggestions et partages" }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(row).toHaveTextContent("Personnalisé : invitations et membres");
    });

    await user.click(row);
    const again = await screen.findByRole("dialog", { name: "Famille" });
    await user.click(within(again).getByRole("radio", { name: "Comme ci-dessus" }));
    await user.click(within(again).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(row).toHaveTextContent("Comme ci-dessus");
    });
    expect(calls).toEqual([
      { category: "core.releases", enabled: false },
      { categories: { "core.members": true, "recipes.sharing": false } },
      "reset",
    ]);
  });
});

describe("messages du socle (C6.4)", () => {
  it("rend les avis du socle avec leurs parametres", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const space = { id: famille.id, name: "Famille", tintIndex: famille.tintIndex };
    notificationServer([
      [
        buildNotification({
          type: "core.invitation.received",
          data: { spaceName: "Amis" },
        }),
        buildNotification({
          type: "core.moderation.opened",
          category: "core.platform",
          actor: null,
          space,
          data: { reason: "MEMBER_REPORT", note: "Recette signalée" },
        }),
        buildNotification({
          type: "core.module.rejected",
          category: "core.platform",
          actor: null,
          space,
          data: { moduleCode: "meal-plan", reason: "Pas encore" },
        }),
        buildNotification({
          type: "core.member.excluded",
          actor: null,
          data: { spaceName: "Colloc" },
        }),
      ],
    ]);
    renderWithProviders(<App />, { route: "/notifications" });
    expect(await screen.findByText(/t'invite dans Amis\./)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Un administrateur consulte Famille en lecture seule pendant 30 minutes. Motif : Signalement d'un membre (Recette signalée)."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ta demande du module Planning des repas pour Famille a été refusée : Pas encore."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Tu ne fais plus partie de Colloc.")).toBeInTheDocument();
  });
});

describe("messages des modules (C6.5)", () => {
  it("rend les avis de Recettes et du Planning avec leur lien", async () => {
    const me = buildMe();
    const famille = buildSpaceDetail({ name: "Famille" });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const space = { id: famille.id, name: "Famille", tintIndex: famille.tintIndex };
    const recipeId = crypto.randomUUID();
    notificationServer([
      [
        buildNotification({
          type: "recipes.suggestion.created",
          category: "recipes.sharing",
          space,
          data: { recipeId, title: "Gratin" },
        }),
        buildNotification({
          type: "recipes.share-request.created",
          category: "recipes.sharing",
          space,
          data: { recipeId, title: "Gratin", targetSpaceName: "Amis", personal: false },
        }),
        buildNotification({
          type: "recipes.recipe.adapted",
          category: "recipes.sharing",
          space,
          data: { recipeId, title: "Gratin", spaceName: "Colloc" },
        }),
        buildNotification({
          type: "meal-plan.meal.changed",
          category: "meal-plan.planning",
          space,
          count: 3,
        }),
        buildNotification({
          type: "meal-plan.plan.generated",
          category: "meal-plan.planning",
          space,
          data: { from: "2026-11-09", to: "2026-11-15", count: 14 },
        }),
      ],
    ]);
    renderWithProviders(<App />, { route: "/notifications" });
    expect(
      await screen.findByRole("link", { name: /propose une modification de « Gratin »/ })
    ).toHaveAttribute("href", `/s/${famille.id}/recipes/${recipeId}`);
    expect(
      screen.getByRole("link", { name: /voudrait partager ta recette « Gratin » dans Amis/ })
    ).toHaveAttribute("href", `/s/${famille.id}/recipes`);
    expect(screen.getByText(/a adapté ta recette « Gratin » dans Colloc\./)).toBeInTheDocument();
    expect(screen.getByText(/a modifié 3 repas du planning de Famille\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /a généré le planning de Famille/ })).toHaveAttribute(
      "href",
      `/s/${famille.id}/meal-plan?day=2026-11-09`
    );
  });
});
