// Recette masquee par la moderation [D178] : son auteur la voit encore, avec le motif.
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

describe("recette masquee par la moderation", () => {
  it("l'auteur voit le bandeau et le motif", async () => {
    const recipe = buildRecipe({ title: "Soupe", hidden: { reason: "Propos injurieux" } });
    const s = recipeServer({ recipes: [recipe] });
    const { container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    const note = await screen.findByRole("note", { name: "Masquée par la modération" });
    expect(note).toHaveTextContent("Propos injurieux");
    expect(note).toHaveTextContent("Les autres membres ne la voient plus.");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("sans masquage, pas de bandeau", async () => {
    const recipe = buildRecipe({ title: "Soupe" });
    const s = recipeServer({ recipes: [recipe] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}` });
    await screen.findByRole("heading", { name: "Soupe" });
    expect(screen.queryByRole("note", { name: "Masquée par la modération" })).toBeNull();
  });
});
