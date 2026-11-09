// Admin, C4.4 : utilisateurs (A12) et mot de passe temporaire (A12b, D134).
import type { AdminUser } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { mockAdminApi } from "../../test/admin-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";

const SAM: AdminUser = {
  id: "5a5a5a5a-5555-4555-8555-555555555555",
  username: "sam",
  email: "sam@exemple.fr",
  avatarUrl: null,
  spaces: [
    { name: "Famille", owner: false },
    { name: "Colloc", owner: true },
  ],
  createdAt: "2026-10-05T10:00:00.000Z",
  lastLoginAt: null,
  temporaryPasswordPending: false,
};

function mockUsers({ email = false } = {}) {
  mockAdminApi();
  const queries: string[] = [];
  const posts: string[] = [];
  server.use(
    http.get("/api/v1/config", () => HttpResponse.json({ features: { email, uploads: false } })),
    http.get("/api/v1/admin/users", ({ request }) => {
      queries.push(new URL(request.url).search);
      return HttpResponse.json({ data: [SAM], total: 34 });
    }),
    http.post("/api/v1/admin/users/:id/temporary-password", ({ params }) => {
      posts.push(String(params.id));
      return HttpResponse.json(
        { password: "tison-7342-cendre-houx", expiresAt: new Date().toISOString() },
        { status: 201 }
      );
    })
  );
  return { queries, posts };
}

describe("utilisateurs (A12)", () => {
  it("liste les comptes, rappelle l'absence d'e-mails, recherche et filtre", async () => {
    const { queries } = mockUsers();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/users" });
    const table = await screen.findByRole("table", { name: "Comptes" });
    const row = within(table).getByRole("row", { name: /sam/ });
    expect(row).toHaveTextContent("sam@exemple.fr");
    expect(row).toHaveTextContent("Famille, Colloc (OWNER)");
    expect(row).toHaveTextContent("Jamais");
    expect(screen.getByText(/34 comptes/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("E-mails non configurés.");
    expect(await axeViolations(container)).toEqual([]);

    await user.type(screen.getByLabelText("Rechercher"), "sa");
    await user.click(screen.getByRole("button", { name: "Inactifs depuis 6 mois" }));
    await waitFor(() => {
      expect(queries.at(-1)).toContain("filter=INACTIVE");
    });
    expect(queries.at(-1)).toContain("query=sa");
  });

  it("avec un SMTP, pas de rappel", async () => {
    mockUsers({ email: true });
    renderWithProviders(<App />, { route: "/admin/users" });
    await screen.findByRole("table", { name: "Comptes" });
    expect(screen.queryByText("E-mails non configurés.")).not.toBeInTheDocument();
  });

  it("reinitialise : le mot de passe temporaire s'affiche une fois", async () => {
    const { posts } = mockUsers();
    const { user } = renderWithProviders(<App />, { route: "/admin/users" });
    await user.click(
      await screen.findByRole("button", { name: "Réinitialiser le mot de passe de sam" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Nouveau mot de passe pour sam" });
    expect(posts).toEqual([SAM.id]);
    expect(within(sheet).getByLabelText("Mot de passe temporaire")).toHaveValue(
      "tison-7342-cendre-houx"
    );
    expect(sheet).toHaveTextContent("il ne sera plus affiché après fermeture");
    expect(sheet).toHaveTextContent("Valable 24 heures, une seule fois");
    await user.click(within(sheet).getByRole("button", { name: "Copier" }));
    expect(await navigator.clipboard.readText()).toBe("tison-7342-cendre-houx");
    await user.click(within(sheet).getByRole("button", { name: "C'est transmis" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
