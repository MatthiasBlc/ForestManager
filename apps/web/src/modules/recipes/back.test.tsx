// Fleche de retour d'une recette selon l'origine (D219) : la page d'ou on l'a
// ouverte (planning a la meme semaine et dans la meme vue, recherche, accueil...),
// la liste des recettes sinon (lien direct, onglet neuf).
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { pushRecentRecipe } from "../../core/search/recent.ts";
import { buildRecipe } from "../../test/fixtures.ts";
import { buildMeal, mealPlanServer } from "../../test/meal-plan-server.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

// Mardi 10 novembre 2026, 10 h (heure locale).
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

function planWithDahl() {
  const dahl = buildRecipe({ title: "Dahl de lentilles" });
  const s = mealPlanServer({
    meals: [
      buildMeal({
        date: "2026-11-17",
        mealTime: "LUNCH",
        kind: "RECIPE",
        title: "Dahl de lentilles",
        recipe: { id: dahl.id, imageUrl: null },
      }),
    ],
  });
  recipeServer({ on: s, recipes: [dahl] });
  return { s, dahl };
}

describe("retour d'une recette (D219)", () => {
  it("ouverte par un lien direct : revient a la liste des recettes", async () => {
    const dahl = buildRecipe({ title: "Dahl de lentilles" });
    const s = recipeServer({ recipes: [dahl] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${dahl.id}`,
    });
    await screen.findByRole("heading", { name: "Dahl de lentilles" });
    await user.click(screen.getByRole("button", { name: "Retour" }));
    expect(await screen.findByRole("article", { name: "Dahl de lentilles" })).toBeInTheDocument();
  });

  it("ouverte depuis le planning : meme semaine, meme vue", async () => {
    const { s } = planWithDahl();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Semaine" }));
    await user.click(screen.getByRole("button", { name: "Semaine suivante" }));
    expect(
      await screen.findByRole("heading", { name: "Du 16 au 22 novembre" })
    ).toBeInTheDocument();

    await user.click(await screen.findByRole("link", { name: /Mardi 17, midi : Dahl/ }));
    await screen.findByRole("heading", { name: "Dahl de lentilles", level: 1 });
    await user.click(screen.getByRole("button", { name: "Retour" }));

    expect(
      await screen.findByRole("heading", { name: "Du 16 au 22 novembre" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semaine" })).toHaveAttribute("aria-pressed", "true");
  });

  it("les sous-pages de la recette ne cassent pas le retour", async () => {
    const { s } = planWithDahl();
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan?day=2026-11-17`,
    });
    await user.click(await screen.findByRole("link", { name: /Mardi 17, midi : Dahl/ }));
    await screen.findByRole("heading", { name: "Dahl de lentilles", level: 1 });
    await user.click(screen.getByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Voir l'historique" }));
    await screen.findByRole("list", { name: "Révisions de Dahl de lentilles" });
    await user.click(screen.getByRole("button", { name: "Retour" }));
    await screen.findByRole("heading", { name: "Dahl de lentilles", level: 1 });
    await user.click(screen.getByRole("button", { name: "Retour" }));

    expect(await screen.findByRole("heading", { name: "Mardi 17 novembre" })).toBeInTheDocument();
  });

  it("ouverte par la recherche : revient a la page ou on l'a lancee", async () => {
    const dahl = buildRecipe({ title: "Dahl de lentilles" });
    const s = recipeServer({ recipes: [dahl] });
    pushRecentRecipe({ id: dahl.id, title: dahl.title, spaceId: s.space.id });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await screen.findByRole("heading", { name: "Membres de Famille" });
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: /Dahl de lentilles/ }));
    await screen.findByRole("heading", { name: "Dahl de lentilles", level: 1 });
    await user.click(screen.getByRole("button", { name: "Retour" }));

    expect(await screen.findByRole("heading", { name: "Membres de Famille" })).toBeInTheDocument();
  });

  it("nouvelle recette annulee : revient a la page d'ou on l'a lancee", async () => {
    const s = recipeServer({ myRole: "OWNER" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await screen.findByRole("heading", { name: "Membres de Famille" });
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: "Nouvelle recette" }));
    await screen.findByLabelText("Titre");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(await screen.findByRole("heading", { name: "Membres de Famille" })).toBeInTheDocument();
  });
});

describe("vue du planning dans l'adresse (D219)", () => {
  it("?view=week ouvre directement la vue Semaine", async () => {
    const { s } = planWithDahl();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan?view=week` });
    expect(await screen.findByRole("heading", { name: "Du 9 au 15 novembre" })).toBeInTheDocument();
  });
});
