// Export (F-EXPORT, P12) et ses entrees : profil, reglages de l'espace,
// suppression de l'espace et du compte (C6b.2) [D37, D192].
import { errorBody, type DataExport } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";
import { spaceServer } from "../../test/space-server.ts";

const EXPORT_ID = "3d6f1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

/** Faux /me/exports : PENDING a la creation, READY a la relecture suivante. */
function exportServer({ refuse }: { refuse?: string } = {}) {
  const bodies: unknown[] = [];
  let reads = 0;
  const base = (over: Partial<DataExport>): DataExport => ({
    id: EXPORT_ID,
    scope: "MY_RECIPES",
    space: null,
    format: "JSON",
    photos: false,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    ...over,
  });
  server.use(
    http.post("/api/v1/me/exports", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      if (refuse) {
        return HttpResponse.json(errorBody("EXPORT_001", { nextAt: refuse }), { status: 429 });
      }
      return HttpResponse.json(base({ scope: body.scope as DataExport["scope"] }), {
        status: 202,
      });
    }),
    http.get("/api/v1/me/exports/:id", () => {
      reads += 1;
      return HttpResponse.json(
        reads > 1
          ? base({
              status: "READY",
              expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            })
          : base({})
      );
    })
  );
  return bodies;
}

describe("F-EXPORT", () => {
  it("exporte ses recettes depuis le profil, puis propose le telechargement", async () => {
    mockSession();
    const bodies = exportServer();
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    await user.click(await screen.findByRole("button", { name: "Exporter mes recettes" }));
    const sheet = await screen.findByRole("dialog", { name: "Exporter mes recettes" });
    // Hors d'un espace dont on est OWNER : pas de choix de portee.
    expect(within(sheet).queryByRole("radiogroup", { name: "Recettes à exporter" })).toBeNull();

    await user.click(within(sheet).getByRole("radio", { name: /Markdown/ }));
    await user.click(within(sheet).getByRole("switch", { name: "Inclure les photos" }));
    await user.click(within(sheet).getByRole("button", { name: "Préparer l'export" }));
    expect(await within(sheet).findByText(/Préparation/)).toBeInTheDocument();
    expect(bodies).toEqual([{ scope: "MY_RECIPES", format: "MARKDOWN", photos: true }]);

    const link = await within(sheet).findByRole("link", { name: "Télécharger" }, { timeout: 3000 });
    expect(link).toHaveAttribute("href", `/api/v1/me/exports/${EXPORT_ID}/download`);
    expect(within(sheet).getByText(/Disponible pendant 24 heures/)).toBeInTheDocument();
  });

  it("l'OWNER exporte l'espace depuis ses reglages, avec le rappel de l'activite", async () => {
    const s = spaceServer({ myRole: "OWNER" });
    const bodies = exportServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Exporter l'espace" }));
    const sheet = await screen.findByRole("dialog", { name: "Exporter des recettes" });
    expect(within(sheet).getByRole("radio", { name: /Tout l'espace Famille/ })).toBeChecked();
    expect(within(sheet).getByText(/Les membres verront/)).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Préparer l'export" }));
    await waitFor(() => {
      expect(bodies).toEqual([
        { scope: "SPACE", spaceId: s.space.id, format: "JSON", photos: false },
      ]);
    });
  });

  it("dit quand le prochain export d'espace sera possible", async () => {
    const s = spaceServer({ myRole: "OWNER" });
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(14, 2, 0, 0);
    exportServer({ refuse: next.toISOString() });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Exporter l'espace" }));
    const sheet = await screen.findByRole("dialog", { name: "Exporter des recettes" });
    await user.click(within(sheet).getByRole("button", { name: "Préparer l'export" }));
    expect(
      await within(sheet).findByText("Un export par jour. Prochain export possible demain à 14:02.")
    ).toBeInTheDocument();
  });

  it("un membre n'exporte pas l'espace depuis les reglages", async () => {
    const s = spaceServer({ myRole: "MODERATOR" });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await screen.findByRole("heading", { name: "Propriété et départ" });
    expect(screen.queryByRole("button", { name: "Exporter l'espace" })).toBeNull();
  });

  it("propose d'exporter avant de supprimer l'espace", async () => {
    const s = spaceServer({ myRole: "OWNER" });
    exportServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Supprimer Famille" }));
    const del = await screen.findByRole("dialog", { name: "Supprimer Famille" });
    await user.click(within(del).getByRole("button", { name: "Exporter d'abord" }));
    expect(
      await screen.findByRole("dialog", { name: "Exporter des recettes" })
    ).toBeInTheDocument();
  });

  it("propose d'exporter ses recettes avant de supprimer son compte", async () => {
    mockSession();
    exportServer();
    server.use(http.get("/api/v1/me/deletion-preview", () => HttpResponse.json({ spaces: [] })));
    const { user } = renderWithProviders(<App />, { route: "/profile/delete" });
    await user.click(await screen.findByRole("button", { name: "Exporter mes recettes" }));
    expect(
      await screen.findByRole("dialog", { name: "Exporter mes recettes" })
    ).toBeInTheDocument();
  });
});
