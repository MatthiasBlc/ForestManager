// Planning (C5.1) : entree de navigation, F-REGLAGES-PLANNING [D11, D58, D180].
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { mealPlanServer } from "../../test/meal-plan-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

// Mardi 10 novembre 2026 (heure locale).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("module Planning dans l'espace", () => {
  it("apparait dans la navigation quand il est actif", async () => {
    const s = mealPlanServer();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const links = await screen.findAllByRole("link", { name: "Planning" });
    expect(links[0]).toHaveAttribute("href", `/s/${s.space.id}/meal-plan`);
  });

  it("un membre ne voit pas les reglages", async () => {
    const s = mealPlanServer({ myRole: "MEMBER" });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    expect(await screen.findByRole("heading", { name: "Planning" })).toBeInTheDocument();
    // Reglages charges : l'absence du bouton vient des droits, pas du chargement.
    expect(await screen.findByRole("heading", { name: "Mardi 10 novembre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Réglages du planning" })).not.toBeInTheDocument();
  });
});

describe("F-REGLAGES-PLANNING", () => {
  it("un moderateur regle repas, portions et debut de semaine, sans le role minimal", async () => {
    const s = mealPlanServer({ myRole: "MODERATOR" });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan`,
    });
    await user.click(await screen.findByRole("button", { name: "Réglages du planning" }));
    const sheet = await screen.findByRole("dialog", { name: "Réglages du planning" });
    expect(within(sheet).getByRole("button", { name: "Midi" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      within(sheet).queryByRole("radiogroup", { name: "Qui peut modifier les repas" })
    ).not.toBeInTheDocument();
    expect(within(sheet).getByText("Membres et plus")).toBeInTheDocument();

    expect(within(sheet).getByRole("button", { name: "Soir" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(sheet).getByRole("button", { name: "Midi" }));
    await user.click(within(sheet).getByRole("button", { name: "Plus" }));
    await user.click(within(sheet).getByRole("button", { name: "Dimanche" }));
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(s.plan.saved).toEqual([
        { mealTimes: ["DINNER"], defaultServings: 5, weekStartsOn: "SUN" },
      ]);
    });
    expect(await screen.findByText("Réglages enregistrés")).toBeInTheDocument();
  });

  it("refuse d'enregistrer sans aucun repas", async () => {
    const s = mealPlanServer({ myRole: "OWNER", settings: { mealTimes: ["DINNER"] } });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Réglages du planning" }));
    const sheet = await screen.findByRole("dialog", { name: "Réglages du planning" });
    await user.click(within(sheet).getByRole("button", { name: "Soir" }));
    expect(within(sheet).getByText("Choisis au moins un repas.")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("l'OWNER choisit qui peut modifier les repas", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Réglages du planning" }));
    const sheet = await screen.findByRole("dialog", { name: "Réglages du planning" });
    const group = within(sheet).getByRole("radiogroup", { name: "Qui peut modifier les repas" });
    await user.click(within(group).getByRole("radio", { name: /Modérateurs et propriétaire/ }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.saved.at(-1)?.editRole).toBe("MODERATOR");
    });
  });
});
