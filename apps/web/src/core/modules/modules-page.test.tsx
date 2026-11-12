import type { CatalogModule } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildCatalogModule } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { spaceServer } from "../../test/space-server.ts";

function catalogServer(myRole: "OWNER" | "MEMBER" = "OWNER") {
  const s = spaceServer({ myRole });
  let catalog: CatalogModule[] = [
    buildCatalogModule({
      code: "recipes",
      isDefault: true,
      granted: true,
      enabled: true,
      sortOrder: 0,
    }),
    buildCatalogModule({
      code: "meal-plan",
      isDefault: false,
      granted: true,
      enabled: false,
      sortOrder: 1,
    }),
    buildCatalogModule({
      code: "shopping",
      status: "AVAILABLE",
      isDefault: false,
      granted: false,
      enabled: false,
      sortOrder: 3,
    }),
    buildCatalogModule({
      code: "films",
      status: "COMING_SOON",
      isDefault: false,
      granted: false,
      enabled: false,
      sortOrder: 4,
    }),
  ];
  const bodies: Record<string, unknown> = {};
  const base = `/api/v1/spaces/${s.space.id}/modules`;
  server.use(
    http.get(base, () => HttpResponse.json({ data: catalog })),
    http.post(`${base}/:code/requests`, async ({ params, request }) => {
      bodies.request = { code: params.code, ...((await request.json()) as object) };
      catalog = catalog.map((m) =>
        m.code === params.code
          ? {
              ...m,
              lastRequest: {
                id: "00000000-0000-4000-8000-0000000000aa",
                moduleCode: m.code,
                status: "PENDING",
                message: null,
                decisionNote: null,
                createdAt: new Date().toISOString(),
                decidedAt: null,
              },
            }
          : m
      );
      return HttpResponse.json(catalog.find((m) => m.code === params.code)?.lastRequest, {
        status: 201,
      });
    }),
    http.post(`${base}/:code/requests/cancel`, ({ params }) => {
      bodies.cancel = params.code;
      catalog = catalog.map((m) => (m.code === params.code ? { ...m, lastRequest: null } : m));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${base}/:code`, async ({ params, request }) => {
      const body = (await request.json()) as { enabled: boolean };
      bodies.toggle = { code: params.code, ...body };
      catalog = catalog.map((m) => (m.code === params.code ? { ...m, enabled: body.enabled } : m));
      return HttpResponse.json({ data: catalog });
    }),
    http.put(`${base}/order`, async ({ request }) => {
      bodies.order = await request.json();
      return HttpResponse.json({ data: catalog });
    })
  );
  return { ...s, bodies, setCatalog: (next: CatalogModule[]) => (catalog = next) };
}

const row = (name: string) => screen.getByRole("listitem", { name });

describe("modules de l'espace (E-MODULES)", () => {
  it("montre chaque module avec son statut (D123)", async () => {
    const s = catalogServer();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/modules` });
    expect(await screen.findByRole("heading", { name: "Modules de Famille" })).toBeInTheDocument();
    await screen.findByRole("listitem", { name: "Recettes" });
    expect(within(row("Recettes")).getByText("Inclus")).toBeInTheDocument();
    expect(within(row("Planning des repas")).getByText("Accordé")).toBeInTheDocument();
    expect(within(row("Liste de courses")).getByText("Disponible")).toBeInTheDocument();
    expect(within(row("films")).getByText("Bientôt")).toBeInTheDocument();
    expect(within(row("films")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("Recettes")).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("l'OWNER demande l'acces avec un message, puis peut annuler", async () => {
    const s = catalogServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/modules` });
    await user.click(
      await within(await screen.findByRole("listitem", { name: "Liste de courses" })).findByRole(
        "button",
        { name: "Demander l'accès" }
      )
    );
    const sheet = screen.getByRole("dialog", { name: "Demander Liste de courses" });
    await user.type(within(sheet).getByLabelText("Message (facultatif)"), "Pour nos courses");
    await user.click(within(sheet).getByRole("button", { name: "Envoyer la demande" }));
    await waitFor(() => {
      expect(s.bodies.request).toEqual({ code: "shopping", message: "Pour nos courses" });
    });
    const item = await screen.findByRole("listitem", { name: "Liste de courses" });
    expect(await within(item).findByText("Demande envoyée")).toBeInTheDocument();
    await user.click(within(item).getByRole("button", { name: "Annuler la demande" }));
    await waitFor(() => {
      expect(s.bodies.cancel).toBe("shopping");
    });
  });

  it("une demande refusee montre son motif et se redemande (D124)", async () => {
    const s = catalogServer();
    s.setCatalog([
      buildCatalogModule({
        code: "shopping",
        isDefault: false,
        granted: false,
        enabled: false,
        lastRequest: {
          id: "00000000-0000-4000-8000-0000000000bb",
          moduleCode: "shopping",
          status: "REJECTED",
          message: null,
          decisionNote: "Pas encore ouvert à tous",
          createdAt: "2026-11-01T10:00:00.000Z",
          decidedAt: "2026-11-02T10:00:00.000Z",
        },
      }),
    ]);
    renderWithProviders(<App />, { route: `/s/${s.space.id}/modules` });
    const item = await screen.findByRole("listitem", { name: "Liste de courses" });
    expect(within(item).getByText(/Pas encore ouvert à tous/)).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Redemander" })).toBeInTheDocument();
  });

  it("active un module accorde et change l'ordre (D131)", async () => {
    const s = catalogServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/modules` });
    const plan = await screen.findByRole("listitem", { name: "Planning des repas" });
    await user.click(within(plan).getByRole("switch", { name: "Actif pour les membres" }));
    await waitFor(() => {
      expect(s.bodies.toggle).toEqual({ code: "meal-plan", enabled: true });
    });
    await user.click(within(plan).getByRole("button", { name: "Monter Planning des repas" }));
    await waitFor(() => {
      expect(s.bodies.order).toEqual({ codes: ["meal-plan", "recipes"] });
    });
  });

  it("un membre consulte sans agir (D54)", async () => {
    const s = catalogServer("MEMBER");
    renderWithProviders(<App />, { route: `/s/${s.space.id}/modules` });
    await screen.findByRole("listitem", { name: "Liste de courses" });
    expect(screen.queryByRole("button", { name: "Demander l'accès" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
