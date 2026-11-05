// Recettes composees (C3.4) : blocs lies dans le detail et l'editeur [D24, D107].
import type { Recipe } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, unitId } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  localStorage.clear();
});

function sauce(): Recipe {
  return buildRecipe({
    title: "Sauce teriyaki",
    isBase: true,
    yieldQuantity: 300,
    yieldUnitId: unitId("ml"),
  });
}

function plat(sub: Recipe, status: "AVAILABLE" | "HIDDEN" | "DELETED" = "AVAILABLE"): Recipe {
  return buildRecipe({
    title: "Saumon teriyaki",
    yieldQuantity: 2,
    blocks: [
      {
        kind: "RECIPE",
        recipeId: sub.id,
        quantity: 150,
        unitId: unitId("ml"),
        status,
        recipe:
          status === "AVAILABLE"
            ? {
                id: sub.id,
                title: sub.title,
                yieldQuantity: sub.yieldQuantity,
                yieldUnitId: sub.yieldUnitId,
                isBase: true,
                blocks: sub.blocks,
              }
            : null,
      },
      ...buildRecipe().blocks,
    ],
  });
}

describe("detail d'une recette composee", () => {
  it("bloc lie : quantite utilisee, sous-recette depliee a l'echelle", async () => {
    const sub = sauce();
    const recipe = plat(sub);
    const s = recipeServer({ recipes: [sub, recipe] });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await screen.findByRole("heading", { name: "Saumon teriyaki" });
    expect(screen.getByText("Composée")).toBeInTheDocument();
    const block = screen.getByRole("region", { name: "Sauce teriyaki" });
    expect(within(block).getByText("Recette liée")).toBeInTheDocument();
    expect(within(block).getByText("150 ml")).toBeInTheDocument();
    expect(within(block).getByRole("link", { name: "Sauce teriyaki" })).toHaveAttribute(
      "href",
      `/s/${s.space.id}/recipes/${sub.id}`
    );

    // Replie par defaut ; deplie : 500 g pour 300 ml, on en utilise la moitie.
    expect(within(block).queryByRole("checkbox", { name: /Pâtes/ })).not.toBeInTheDocument();
    await user.click(within(block).getByRole("button", { name: "Déplier Sauce teriyaki" }));
    expect(within(block).getByRole("checkbox", { name: /250 g Pâtes/ })).toBeInTheDocument();

    // 4 portions au lieu de 2 : 300 ml de sauce, 500 g de pates.
    const portions = screen.getByRole("group", { name: "Portions" });
    await user.click(within(portions).getByLabelText("Plus"));
    await user.click(within(portions).getByLabelText("Plus"));
    expect(within(block).getByText("300 ml")).toBeInTheDocument();
    expect(within(block).getByRole("checkbox", { name: /500 g Pâtes/ })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("sous-recette non visible dans l'espace", async () => {
    const hidden = plat(sauce(), "HIDDEN");
    const s = recipeServer({ recipes: [hidden] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${hidden.id}` });
    const block = await screen.findByRole("region", { name: "Recette non disponible" });
    expect(within(block).getByText(/n'est pas visible dans Famille/)).toBeInTheDocument();
    expect(within(block).getByText("150 ml")).toBeInTheDocument();
  });

  it("sous-recette supprimee : bloc signale", async () => {
    const sub = sauce();
    const deleted = plat(sub, "DELETED");
    const s = recipeServer({ recipes: [deleted] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${deleted.id}` });
    const block = await screen.findByRole("region", { name: "Recette supprimée" });
    expect(within(block).getByText(/a été supprimée/)).toBeInTheDocument();
  });

  it("supprimer une recette utilisee ailleurs previent (D24)", async () => {
    const sub = buildRecipe({ title: "Sauce", usedBy: 2 });
    const s = recipeServer({ recipes: [sub] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${sub.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    const sheet = screen.getByRole("dialog", { name: "Supprimer « Sauce » ?" });
    expect(within(sheet).getByText(/utilisée dans 2 recettes/)).toBeInTheDocument();
  });
});

describe("lier une recette dans l'editeur (F-AJOUT-BLOC, F-LIER-RECETTE)", () => {
  it("ajoute un bloc lie : bases d'abord, recette en cours exclue, quantite dans son unite", async () => {
    const sub = sauce();
    const other = buildRecipe({ title: "Poulet teriyaki" });
    const current = buildRecipe({ title: "Saumon teriyaki" });
    const s = recipeServer({ recipes: [other, sub, current] });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${current.id}/edit`,
    });
    await user.click(await screen.findByRole("button", { name: "Ajouter un bloc" }));
    const choice = screen.getByRole("dialog", { name: "Ajouter un bloc" });
    await user.click(within(choice).getByRole("button", { name: /Lier une recette/ }));

    const sheet = await screen.findByRole("dialog", { name: "Lier une recette" });
    await user.type(within(sheet).getByLabelText("Rechercher dans tes espaces"), "teri");
    const list = within(sheet).getByRole("listbox", { name: "Recettes trouvées" });
    await waitFor(() => {
      expect(within(list).getAllByRole("option")).toHaveLength(3);
    });
    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveTextContent("Sauce teriyaki");
    expect(options[0]).toHaveTextContent("rend 300 ml");
    expect(within(list).getByRole("option", { name: /Saumon teriyaki/ })).toBeDisabled();

    await user.click(options[0] as HTMLElement);
    expect(within(sheet).getByText("ml sur 300")).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText("Quantité utilisée"), "150");
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Lier Sauce teriyaki" }));

    const block = await screen.findByRole("group", { name: "Recette liée : Sauce teriyaki" });
    expect(within(block).getByLabelText("Quantité utilisée")).toHaveValue("150");
    await user.click(screen.getByRole("button", { name: "Enregistrer la révision 2" }));
    await screen.findByRole("heading", { name: "Saumon teriyaki" });
    const body = s.recipes.bodies.update as { blocks: unknown[] };
    expect(body.blocks.at(-1)).toEqual({
      kind: "RECIPE",
      recipeId: sub.id,
      quantity: 150,
      unitId: unitId("ml"),
    });
  });

  it("garde les liens d'une recette composee, meme supprimes, et change la quantite", async () => {
    const sub = sauce();
    const recipe = plat(sub, "DELETED");
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    const block = await screen.findByRole("group", { name: "Recette liée : Recette supprimée" });
    const quantity = within(block).getByLabelText("Quantité utilisée");
    await user.clear(quantity);
    await user.type(quantity, "75");
    await user.click(screen.getByRole("button", { name: "Enregistrer la révision 2" }));
    await waitFor(() => {
      expect(s.recipes.bodies.update).toBeDefined();
    });
    const body = s.recipes.bodies.update as { blocks: unknown[] };
    expect(body.blocks[0]).toEqual({
      kind: "RECIPE",
      recipeId: sub.id,
      quantity: 75,
      unitId: unitId("ml"),
    });
  });
});
