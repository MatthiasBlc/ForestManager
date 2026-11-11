// Admin, C4.2 : demandes d'acces (A03, A03b) et catalogue des modules (A04).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { mockAdminApi, SPACES } from "../../test/admin-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";

describe("demandes d'acces aux modules", () => {
  it("le tableau de bord et la navigation signalent la demande en attente", async () => {
    mockAdminApi();
    const { user } = renderWithProviders(<App />, { route: "/admin" });
    const todo = await screen.findByRole("link", { name: /1 demande d'accès aux modules/i });
    expect(todo).toHaveTextContent("Colloc : Planning des repas");
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: /Demandes d'accès/ })).toHaveTextContent("1");
    await user.click(todo);
    expect(
      await screen.findByRole("heading", { name: "Demandes d'accès aux modules" })
    ).toBeInTheDocument();
  });

  it("liste la demande avec l'espace, le demandeur et le message, puis l'accorde", async () => {
    const api = mockAdminApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/requests" });
    const card = await screen.findByRole("article", { name: "Colloc demande Planning des repas" });
    expect(card).toHaveTextContent("Demandée par matthias");
    expect(card).toHaveTextContent("On voudrait organiser les repas de la semaine.");
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(card).getByRole("button", { name: "Accorder" }));
    await waitFor(() => {
      expect(api.calls).toContain(`approve:${api.requests[0]?.id ?? ""}`);
    });
    expect(await screen.findByText("Aucune demande en attente")).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Traitées récemment" });
    // Tableau large : sa zone de defilement s'atteint au clavier (axe scrollable-region-focusable).
    expect(screen.getByRole("region", { name: "Traitées récemment" })).toHaveAttribute(
      "tabindex",
      "0"
    );
    expect(within(history).getByText("Accordée")).toBeInTheDocument();
  });

  it("refuser demande un motif, montre a l'OWNER", async () => {
    const api = mockAdminApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/requests" });
    const card = await screen.findByRole("article", { name: "Colloc demande Planning des repas" });
    await user.click(within(card).getByRole("button", { name: "Refuser" }));
    const sheet = await screen.findByRole("dialog", { name: "Refuser la demande de Colloc" });
    expect(sheet).toHaveTextContent(/matthias verra ce motif/);
    await user.click(within(sheet).getByRole("button", { name: "Refuser la demande" }));
    expect(await within(sheet).findByText(/motif/i, { selector: ".fm-hint" })).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText("Motif"), "Revenez en décembre.");
    await user.click(within(sheet).getByRole("button", { name: "Refuser la demande" }));
    await waitFor(() => {
      expect(api.calls).toContain("reject:Revenez en décembre.");
    });
    const history = await screen.findByRole("table", { name: "Traitées récemment" });
    expect(within(history).getByText("Refusée")).toBeInTheDocument();
    expect(within(history).getByText("Revenez en décembre.")).toBeInTheDocument();
  });
});

describe("catalogue des modules", () => {
  it("montre le statut et l'usage ; le module fourni a chaque espace ne se change pas", async () => {
    const api = mockAdminApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/modules" });
    expect(
      await screen.findByRole("heading", { name: "Catalogue des modules" })
    ).toBeInTheDocument();
    const recipes = await screen.findByRole("article", { name: "Recettes" });
    expect(
      within(recipes).getByText(/Fourni à la création de chaque espace : 43 espaces/)
    ).toBeInTheDocument();
    expect(within(recipes).queryByLabelText("Statut")).not.toBeInTheDocument();

    const mealPlan = screen.getByRole("article", { name: "Planning des repas" });
    expect(
      within(mealPlan).getByText(/Accordé à 1 espace, activé dans 0. 1 demande en attente./)
    ).toBeInTheDocument();
    await user.selectOptions(within(mealPlan).getByLabelText("Statut"), "AVAILABLE");
    await waitFor(() => {
      expect(api.calls).toContain("status:meal-plan:AVAILABLE");
    });
    expect(await axeViolations(container)).toEqual([]);
  });

  it("liste les espaces ayant acces et retire un acces apres confirmation", async () => {
    const api = mockAdminApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/modules" });
    const table = await screen.findByRole("table", {
      name: "Espaces ayant accès à « Planning des repas »",
    });
    const row = within(table).getByRole("row", { name: /Foyer/ });
    expect(row).toHaveTextContent("Pas encore activé");
    await user.click(within(row).getByRole("button", { name: "Retirer l'accès" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Retirer « Planning des repas » à Foyer ?",
    });
    expect(sheet).toHaveTextContent(/données sont conservées/);
    await user.click(within(sheet).getByRole("button", { name: "Retirer l'accès" }));
    await waitFor(() => {
      expect(api.calls).toContain(`revoke:meal-plan:${SPACES.FOYER.id}`);
    });
    expect(await screen.findByText("Aucun espace n'a accès à ce module.")).toBeInTheDocument();
  });

  it("accorde un module a un espace trouve par son nom", async () => {
    const api = mockAdminApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/modules" });
    await user.click(await screen.findByRole("button", { name: "Accorder à un espace" }));
    const sheet = await screen.findByRole("dialog", { name: "Accorder « Planning des repas »" });
    await user.type(within(sheet).getByLabelText("Nom de l'espace"), "ski");
    const result = await within(sheet).findByRole("button", { name: /Vacances au ski/ });
    expect(result).toHaveTextContent("OWNER : paul");
    await user.click(result);
    await waitFor(() => {
      expect(api.calls).toContain(`grant:meal-plan:${SPACES.SKI.id}`);
    });
    const table = await screen.findByRole("table", {
      name: "Espaces ayant accès à « Planning des repas »",
    });
    expect(within(table).getByRole("row", { name: /Vacances au ski/ })).toBeInTheDocument();
  });

  it("change de module pour voir ses espaces", async () => {
    mockAdminApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/modules" });
    const shopping = await screen.findByRole("article", { name: "Liste de courses" });
    await user.click(within(shopping).getByRole("button", { name: "Voir les espaces" }));
    expect(
      await screen.findByRole("table", { name: "Espaces ayant accès à « Liste de courses »" })
    ).toBeInTheDocument();
  });
});
