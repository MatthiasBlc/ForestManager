// Admin, C4.5 : espaces (A09), acces de moderation (A09b) et vue de moderation [D122, D178].
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { FAMILLE, SOUPE, TARTE, VACANCES, mockSpacesApi } from "../../test/admin-spaces-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";

describe("espaces (A09)", () => {
  it("informations generales seulement ; restaurer un espace en suppression", async () => {
    const { calls } = mockSpacesApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/spaces" });
    const table = await screen.findByRole("table", { name: "Espaces" });
    const row = within(table).getByRole("row", { name: /Famille/ });
    expect(row).toHaveTextContent("matthias");
    expect(row).toHaveTextContent("Recettes, Planning des repas");
    expect(row).toHaveTextContent("Actif");
    expect(screen.getByRole("button", { name: "Groupes (9)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "En suppression (1)" }));
    const deleting = await within(table).findByRole("row", { name: /Vacances 2025/ });
    expect(deleting).toHaveTextContent("Purge dans 12 j");
    await user.click(within(deleting).getByRole("button", { name: "Restaurer Vacances 2025" }));
    await waitFor(() => {
      expect(calls).toContainEqual(
        expect.objectContaining({ path: `/admin/spaces/${VACANCES.id}/restore` })
      );
    });
  });

  it("moderer : motif et precision obligatoires, puis vue en lecture seule", async () => {
    const { calls } = mockSpacesApi({ access: false });
    const { user } = renderWithProviders(<App />, { route: "/admin/spaces" });
    await user.click(await screen.findByRole("button", { name: "Modérer Famille" }));
    const sheet = await screen.findByRole("dialog", { name: "Ouvrir le contenu de Famille" });
    expect(sheet).toHaveTextContent("Accès en lecture seule pendant 30 minutes.");
    expect(sheet).toHaveTextContent("Cet accès et son motif seront signalés à matthias");
    await user.click(within(sheet).getByRole("button", { name: "Ouvrir en lecture seule" }));
    expect(await within(sheet).findByText("La précision est obligatoire.")).toBeVisible();

    await user.click(within(sheet).getByRole("radio", { name: "Demande de l'OWNER" }));
    await user.type(within(sheet).getByLabelText("Précision"), "Demande par message");
    await user.click(within(sheet).getByRole("button", { name: "Ouvrir en lecture seule" }));
    await waitFor(() => {
      expect(calls).toContainEqual({
        method: "POST",
        path: `/admin/spaces/${FAMILLE.id}/moderation`,
        body: { reason: "OWNER_REQUEST", note: "Demande par message" },
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Modération : Famille" })
    ).toBeInTheDocument();
  });
});

describe("vue de moderation", () => {
  it("lit une recette et la masque avec un motif", async () => {
    const { calls } = mockSpacesApi();
    const { user, container } = renderWithProviders(<App />, {
      route: `/admin/moderation/${FAMILLE.id}`,
    });
    expect(await screen.findByText(/Lecture seule, encore 30 min/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Soupe de Sam/ }));
    const detail = await screen.findByRole("region", { name: SOUPE.title });
    expect(detail).toHaveTextContent("Pâtes");
    expect(within(detail).queryByRole("button", { name: /Retirer de cet espace/ })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(detail).getByRole("button", { name: "Masquer…" }));
    const sheet = await screen.findByRole("dialog", { name: `Masquer « ${SOUPE.title} »` });
    await user.type(within(sheet).getByLabelText("Motif"), "Propos injurieux");
    await user.click(within(sheet).getByRole("button", { name: "Masquer" }));
    await waitFor(() => {
      expect(calls).toContainEqual({
        method: "POST",
        path: `/admin/moderation/${FAMILLE.id}/recipes/${SOUPE.id}/hide`,
        body: { note: "Propos injurieux" },
      });
    });
    expect(await screen.findByRole("button", { name: /Soupe de Sam/ })).toHaveTextContent(
      "Masquée"
    );
  });

  it("retire une recette partagee, puis ferme l'acces", async () => {
    const { calls } = mockSpacesApi();
    const { user } = renderWithProviders(<App />, { route: `/admin/moderation/${FAMILLE.id}` });
    await user.click(await screen.findByRole("button", { name: /Tarte partagée/ }));
    const detail = await screen.findByRole("region", { name: TARTE.title });
    await user.click(within(detail).getByRole("button", { name: "Retirer de cet espace…" }));
    const sheet = await screen.findByRole("dialog", {
      name: `Retirer « ${TARTE.title} » de Famille`,
    });
    expect(sheet).toHaveTextContent("Elle reste chez son auteur");
    await user.type(within(sheet).getByLabelText("Motif"), "Hors sujet");
    await user.click(within(sheet).getByRole("button", { name: "Retirer" }));
    await waitFor(() => {
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: `/admin/moderation/${FAMILLE.id}/recipes/${TARTE.id}/remove`,
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Fermer l'accès" }));
    expect(await screen.findByRole("table", { name: "Espaces" })).toBeInTheDocument();
  });

  it("sans acces valable : message et retour aux espaces", async () => {
    mockSpacesApi({ access: false });
    renderWithProviders(<App />, { route: `/admin/moderation/${FAMILLE.id}` });
    expect(await screen.findByText(/Accès de modération requis/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revenir aux espaces" })).toHaveAttribute(
      "href",
      "/admin/spaces"
    );
  });
});
