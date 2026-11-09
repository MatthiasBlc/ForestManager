// Admin, C4.6 : tableau de bord (A02, A02m), journal d'audit (A11), reglages (A13).
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import {
  SETTINGS,
  buildAuditEntry,
  buildDashboard,
  mockAdminApi,
} from "../../test/admin-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";

const MERGED = buildAuditEntry({
  id: "b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  action: "ingredient.merged",
  category: "REFERENTIALS",
  targetType: "ingredient",
  data: { intoId: "x", recipeCount: 3, name: "sauce soya" },
});
const OPENED = buildAuditEntry({
  id: "c3c3c3c3-cccc-4ccc-8ccc-cccccccccccc",
  action: "moderation.opened",
  category: "MODERATION",
  targetType: "space",
  data: { reason: "MEMBER_REPORT", note: "Propos insultants" },
});

describe("tableau de bord (A02)", () => {
  it("a traiter, chiffres, services et dernieres actions", async () => {
    mockAdminApi();
    server.use(
      http.get("/api/v1/admin/dashboard", () =>
        HttpResponse.json(
          buildDashboard({
            newIngredients: { count: 4, duplicates: ["tomates cerises"] },
            deletingSpaces: [
              {
                id: "7c7c7c7c-7777-4777-8777-777777777777",
                name: "Vacances 2025",
                purgeAfter: new Date(Date.now() + 12 * 24 * 3600 * 1000 - 60_000).toISOString(),
              },
            ],
            recent: [MERGED, OPENED],
          })
        )
      )
    );
    const { container } = renderWithProviders(<App />, { route: "/admin" });
    const ingredients = await screen.findByRole("link", { name: /4 nouveaux ingrédients/i });
    expect(ingredients).toHaveTextContent("1 doublon probable : « tomates cerises »");
    expect(ingredients).toHaveAttribute("href", "/admin/ingredients");
    expect(screen.getByRole("link", { name: /1 espace en suppression/i })).toHaveTextContent(
      "« Vacances 2025 » sera purgé dans 12 jours"
    );
    const platform = screen.getByRole("region", { name: "La plateforme" });
    expect(platform).toHaveTextContent("34utilisateurs");
    expect(platform).toHaveTextContent("9espaces groupe (et 34 perso)");
    expect(platform).toHaveTextContent("2espaces avec Planning des repas");
    const services = screen.getByRole("region", { name: "État des services" });
    expect(services).toHaveTextContent("Envoi d'e-mailsNon configuré");
    expect(services).toHaveTextContent("Version en production2.0.0");
    const recent = screen.getByRole("region", { name: "Dernières actions admin" });
    expect(recent).toHaveTextContent("Ingrédient fusionné : sauce soya");
    expect(within(recent).getByRole("link", { name: "Tout le journal" })).toHaveAttribute(
      "href",
      "/admin/audit"
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("journal d'audit (A11)", () => {
  it("liste, filtre par categorie et charge les plus anciennes", async () => {
    mockAdminApi();
    const queries: string[] = [];
    server.use(
      http.get("/api/v1/admin/audit", ({ request }) => {
        const params = new URL(request.url).searchParams;
        queries.push(params.toString());
        const offset = Number(params.get("offset") ?? 0);
        const data = offset === 0 ? [OPENED, MERGED] : [buildAuditEntry()];
        return HttpResponse.json({ data, total: 3 });
      })
    );
    const { user, container } = renderWithProviders(<App />, { route: "/admin/audit" });
    const table = await screen.findByRole("table", { name: "Journal d'audit" });
    const row = within(table).getByRole("row", { name: /Accès de modération/ });
    expect(row).toHaveTextContent("root_admin");
    expect(row).toHaveTextContent("Signalement d'un membre : Propos insultants");
    expect(within(table).getByRole("row", { name: /Ingrédient fusionné/ })).toHaveTextContent(
      "3 recettes mises à jour"
    );
    expect(screen.getByText("2 entrées sur 3")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Voir les plus anciennes" }));
    expect(await within(table).findByRole("row", { name: /Connexion/ })).toBeInTheDocument();
    expect(screen.getByText("3 entrées sur 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir les plus anciennes" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Modération" }));
    await waitFor(() => {
      expect(queries.at(-1)).toContain("category=MODERATION");
    });
  });
});

describe("reglages (A13, D135)", () => {
  it("etat de chaque service et test", async () => {
    mockAdminApi();
    const tested: string[] = [];
    server.use(
      http.get("/api/v1/admin/settings", () => HttpResponse.json(SETTINGS)),
      http.post("/api/v1/admin/settings/test/:service", ({ params }) => {
        tested.push(String(params.service));
        return HttpResponse.json({
          ok: true,
          message: "Écriture, lecture et suppression réussies.",
        });
      })
    );
    const { user, container } = renderWithProviders(<App />, { route: "/admin/settings" });
    const email = await screen.findByRole("region", { name: "Envoi d'e-mails (SMTP)" });
    expect(email).toHaveTextContent("Non configuré");
    expect(within(email).getByRole("button", { name: "Envoyer un e-mail de test" })).toBeDisabled();
    const storage = screen.getByRole("region", { name: "Stockage des photos (S3)" });
    expect(storage).toHaveTextContent("forest-photos");
    expect(screen.getByRole("region", { name: "Suivi des erreurs (Bugsink)" })).toHaveTextContent(
      "Pas encore branché"
    );
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(storage).getByRole("button", { name: "Tester la connexion" }));
    expect(
      await within(storage).findByText("Écriture, lecture et suppression réussies.")
    ).toBeVisible();
    expect(tested).toEqual(["storage"]);
  });
});
