// Suggestions (C3.6) : E-SUGGESTION-EDITION, E-SUGGESTION, E-SUGGESTION-Refus,
// E-SUGGESTION-Refusee, bandeaux [D04, D140, D166].
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildSpaceDetail, buildSuggestion, contentView, uuid } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  localStorage.clear();
});

const lea = { id: uuid(), username: "lea", avatarUrl: null };

describe("rediger une suggestion (E-SUGGESTION-EDITION)", () => {
  it("un membre propose ses changements avec un mot ; pas de tags", async () => {
    const s = recipeServer();
    const recipe = s.add({
      title: "Gratin de pâtes",
      author: lea,
      can: { edit: false, delete: false, share: false },
    });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Suggérer une modification" }));
    expect(
      await screen.findByText("Mode suggestion : lea verra tes changements et décidera.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tags" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Titre"), " maison");
    await user.type(screen.getByLabelText("Un mot pour lea (facultatif)"), "Pour Noël");
    await user.click(screen.getByRole("button", { name: "Envoyer la suggestion" }));
    await waitFor(() => {
      expect(s.recipes.bodies.suggest).toMatchObject({
        title: "Gratin de pâtes maison",
        revision: 1,
        message: "Pour Noël",
      });
    });
    expect(s.recipes.bodies.suggest).not.toHaveProperty("globalTagIds");
    expect(await screen.findByText("Suggestion envoyée à lea")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Ta suggestion est en attente/ })
    ).toBeInTheDocument();
  });

  it("l'auteur ne suggere pas : il modifie", async () => {
    const s = recipeServer();
    const recipe = s.add();
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await screen.findByRole("menuitem", { name: "Voir l'historique" });
    expect(
      screen.queryByRole("menuitem", { name: "Suggérer une modification" })
    ).not.toBeInTheDocument();
  });
});

describe("examiner une suggestion (E-SUGGESTION)", () => {
  it("bandeau sur la recette, effet sur la version actuelle, accepter", async () => {
    const s = recipeServer();
    const recipe = s.add({ title: "Saumon teriyaki", cookMinutes: 30 });
    const suggestion = buildSuggestion(recipe);
    s.recipes.suggestions.push(suggestion);
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("link", { name: /Suggestion de sam/ }));
    expect(
      await screen.findByText(/Basée sur la révision 1, la version actuelle/)
    ).toBeInTheDocument();
    expect(screen.getByText("« Le saumon reste cru à cœur en 30 minutes. »")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Cuisson/ });
    expect(within(row).getByText("30 min")).toBeInTheDocument();
    expect(within(row).getByText("40 min")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Accepter la suggestion" }));
    await waitFor(() => {
      expect(s.recipes.bodies.accept).toEqual({ revision: 1 });
    });
    expect(await screen.findByText("Suggestion acceptée : révision 2")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Saumon teriyaki", level: 1 })
    ).toBeInTheDocument();
  });

  it("recette changee depuis : revision de base et conflit signales", async () => {
    const s = recipeServer();
    const recipe = s.add({ currentRevision: 3, cookMinutes: 50 });
    s.recipes.suggestions.push(
      buildSuggestion(recipe, {
        baseRevision: 1,
        result: contentView(recipe, { cookMinutes: 40 }),
        conflicts: ["cook"],
      })
    );
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("link", { name: /Suggestion de sam/ }));
    expect(await screen.findByText(/Basée sur la révision 1 \(actuelle : 3\)/)).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Cuisson/ });
    expect(within(row).getByText("Changé des deux côtés")).toBeInTheDocument();
  });

  it("refuser avec un mot (E-SUGGESTION-Refus)", async () => {
    const s = recipeServer();
    const recipe = s.add();
    const suggestion = buildSuggestion(recipe);
    s.recipes.suggestions.push(suggestion);
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/suggestions/${suggestion.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Refuser" }));
    const sheet = screen.getByRole("dialog", { name: "Refuser la suggestion" });
    expect(within(sheet).getByText(/Ta recette ne change pas/)).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText("Un mot pour sam (facultatif)"), "Trop cuit");
    await user.click(within(sheet).getByRole("button", { name: "Refuser" }));
    await waitFor(() => {
      expect(s.recipes.bodies.reject).toEqual({ message: "Trop cuit" });
    });
    expect(await screen.findByText("Suggestion refusée")).toBeInTheDocument();
  });

  it("bandeau des suggestions a examiner sur la liste", async () => {
    const s = recipeServer();
    const recipe = s.add({ title: "Saumon teriyaki" });
    s.recipes.suggestions.push(buildSuggestion(recipe));
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click(await screen.findByRole("link", { name: /1 suggestion à examiner/ }));
    expect(
      await screen.findByRole("button", { name: "Accepter la suggestion" })
    ).toBeInTheDocument();
  });
});

describe("cote suggereur", () => {
  it("retirer sa suggestion en attente", async () => {
    const s = recipeServer();
    const recipe = s.add({ author: lea, can: { edit: false, delete: false, share: false } });
    const suggestion = buildSuggestion(recipe, {
      proposer: { id: s.me.id, username: "matthias", avatarUrl: null },
      can: { decide: false, withdraw: true, convert: false },
    });
    s.recipes.suggestions.push(suggestion);
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/suggestions/${suggestion.id}`,
    });
    expect(await screen.findByText(/En attente de la décision de lea/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accepter la suggestion" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retirer ma suggestion" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("withdraw");
    });
    expect(await screen.findByText("Suggestion retirée")).toBeInTheDocument();
  });

  it("suggestion refusee : le mot du decideur, puis en faire son adaptation", async () => {
    const amis = buildSpaceDetail({ name: "Amis", tintIndex: 4, myRole: "MEMBER" });
    const s = recipeServer({ extraSpaces: [amis] });
    const recipe = s.add({
      title: "Saumon teriyaki",
      author: lea,
      can: { edit: false, delete: false, share: false },
    });
    const suggestion = buildSuggestion(recipe, {
      proposer: { id: s.me.id, username: "matthias", avatarUrl: null },
      status: "REJECTED",
      decidedBy: lea,
      decidedAt: new Date().toISOString(),
      decisionMessage: "30 minutes suffisent avec des pavés fins.",
      can: { decide: false, withdraw: false, convert: true },
    });
    s.recipes.suggestions.push(suggestion);
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("link", { name: /Ta suggestion a été refusée/ }));
    expect(
      await screen.findByText(/lea a refusé ta suggestion sur Saumon teriyaki/)
    ).toBeInTheDocument();
    expect(screen.getByText("« 30 minutes suffisent avec des pavés fins. »")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "En faire mon adaptation" }));
    const sheet = screen.getByRole("dialog", { name: "En faire mon adaptation" });
    await user.click(
      within(within(sheet).getByRole("group", { name: "Espace de l'adaptation" })).getByRole(
        "button",
        { name: "Amis" }
      )
    );
    await user.click(within(sheet).getByRole("button", { name: "Créer l'adaptation" }));
    await waitFor(() => {
      expect(s.recipes.bodies.convert).toEqual({ targetSpaceId: amis.id });
    });
    expect(await screen.findByText("Adaptation créée dans Amis")).toBeInTheDocument();
  });
});
