// Historique des revisions (C3.3, E-HISTORIQUE) : liste, restauration [D55, F-REC-8].
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, buildRevision } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

function history(recipeId: string) {
  return {
    [recipeId]: [
      buildRevision({
        number: 3,
        source: "RESTORE",
        author: { id: "00000000-0000-4000-8000-0000000000a1", username: "sam", avatarUrl: null },
        changes: ["title", "times"],
      }),
      buildRevision({ number: 2, source: "EDIT", changes: ["ingredients"] }),
      buildRevision({ number: 1, source: "CREATE" }),
    ],
  };
}

describe("historique des revisions (E-HISTORIQUE)", () => {
  it("s'ouvre depuis le menu de la recette et liste les revisions", async () => {
    const recipe = buildRecipe({ title: "Gratin", currentRevision: 3 });
    const s = recipeServer({ recipes: [recipe], revisions: history(recipe.id) });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Voir l'historique" }));

    const list = await screen.findByRole("list", { name: "Révisions de Gratin" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Restaurée par sam");
    expect(items[0]).toHaveTextContent("Actuelle");
    expect(items[0]).toHaveTextContent(/Titre, temps · \d+ nov\./);
    expect(items[1]).toHaveTextContent("Modifiée par lea");
    expect(items[1]).toHaveTextContent(/Ingrédients · /);
    expect(items[2]).toHaveTextContent("Créée par lea");
    expect(within(items[0] as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Restaurer crée une nouvelle révision : rien n'est effacé.")
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("restaure une revision et revient a la recette (D55)", async () => {
    const recipe = buildRecipe({ title: "Gratin", currentRevision: 3 });
    const s = recipeServer({ recipes: [recipe], revisions: history(recipe.id) });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/history`,
    });
    await user.click(await screen.findByRole("button", { name: "Restaurer la révision 2" }));
    expect(await screen.findByRole("heading", { name: "Gratin (r2)" })).toBeInTheDocument();
    expect(screen.getByText("par lea · révision 4")).toBeInTheDocument();
    expect(screen.getByText("Révision 2 restaurée")).toBeInTheDocument();
    expect(s.recipes.bodies.restore).toEqual({ number: 2, revision: 3 });
  });

  it("conflit : la recette a change entre-temps (RECIPE_004)", async () => {
    const recipe = buildRecipe({ title: "Gratin", currentRevision: 3 });
    const s = recipeServer({ recipes: [recipe], revisions: history(recipe.id) });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/history`,
    });
    const button = await screen.findByRole("button", { name: "Restaurer la révision 1" });
    s.recipes.recipes = [{ ...recipe, currentRevision: 4 }];
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(/modifiée entre-temps/);
  });

  it("sans droit de modifier : historique lisible, pas de restauration", async () => {
    const recipe = buildRecipe({ currentRevision: 3, can: { edit: false, delete: false } });
    const s = recipeServer({ recipes: [recipe], revisions: history(recipe.id) });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}/history` });
    await screen.findByRole("list", { name: `Révisions de ${recipe.title}` });
    expect(screen.queryByRole("button", { name: /Restaurer/ })).not.toBeInTheDocument();
  });
});
