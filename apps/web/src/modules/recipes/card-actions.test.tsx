// Actions d'une carte de recette (F-ACTIONS) : appui long, clic droit ou
// touche Menu sur la carte ouvrent les memes actions que le "..." du detail.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, buildRevision } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("actions d'une carte (F-ACTIONS)", () => {
  it("l'appui long ouvre les actions de la recette, sans ouvrir la recette", async () => {
    const s = recipeServer();
    const recipe = s.add({ title: "Saumon teriyaki" });
    const { container } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const card = await screen.findByRole("article", { name: "Saumon teriyaki" });
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    const sheet = await screen.findByRole("dialog", { name: "Saumon teriyaki" });
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    const actions = await within(sheet).findByRole("group", {
      name: "Actions pour Saumon teriyaki",
    });
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual([
      "Modifier",
      "Partager dans un espace",
      "Adapter pour un espace",
      "Voir l'historique",
      "Supprimer",
    ]);
    expect(screen.queryByRole("heading", { level: 1, name: recipe.title })).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("le clic droit ouvre les actions ; Voir l'historique y mene", async () => {
    const recipe = buildRecipe({ title: "Gratin" });
    const s = recipeServer({
      recipes: [recipe],
      revisions: { [recipe.id]: [buildRevision({ number: 1, source: "CREATE" })] },
    });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const card = await screen.findByRole("article", { name: "Gratin" });
    await user.pointer({ keys: "[MouseRight]", target: card });
    const sheet = await screen.findByRole("dialog", { name: "Gratin" });
    await user.click(await within(sheet).findByRole("button", { name: "Voir l'historique" }));
    expect(await screen.findByRole("list", { name: "Révisions de Gratin" })).toBeInTheDocument();
  });

  it("la touche Menu ouvre les actions ; supprimer reste sur la liste", async () => {
    const s = recipeServer({ recipes: [buildRecipe({ title: "Gratin" })] });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const card = await screen.findByRole("article", { name: "Gratin" });
    card.focus();
    await user.keyboard("{ContextMenu}");
    const sheet = await screen.findByRole("dialog", { name: "Gratin" });
    await user.click(await within(sheet).findByRole("button", { name: "Supprimer" }));
    const confirm = await screen.findByRole("dialog", { name: "Supprimer « Gratin » ?" });
    await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Recette supprimée")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Pas encore de recette dans Famille" });
  });

  it("sans droit de modifier : ni Modifier ni Supprimer", async () => {
    const s = recipeServer({
      recipes: [
        buildRecipe({
          title: "Gratin",
          can: { edit: false, delete: false, share: true, removeFromSpace: false },
        }),
      ],
    });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByRole("article", { name: "Gratin" }),
    });
    const sheet = await screen.findByRole("dialog", { name: "Gratin" });
    await within(sheet).findByRole("button", { name: "Voir l'historique" });
    expect(within(sheet).queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("Mes recettes : supprimer depuis la carte reste sur Mes recettes", async () => {
    const s = recipeServer();
    s.add({ title: "Dahl" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.personal.id}/recipes` });
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByRole("article", { name: "Dahl" }),
    });
    const sheet = await screen.findByRole("dialog", { name: "Dahl" });
    await user.click(await within(sheet).findByRole("button", { name: "Supprimer" }));
    const confirm = await screen.findByRole("dialog", { name: "Supprimer « Dahl » ?" });
    await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
    await screen.findByText("Recette supprimée");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Pas encore de recette à toi" })).toBeVisible();
    });
  });

  it('Accueil : l\'appui long sur une carte "Recemment ajoutees" ouvre ses actions', async () => {
    const s = recipeServer();
    const recipe = s.add({ title: "Tarte aux pommes" });
    server.use(
      http.get("/api/v1/me/home", () =>
        HttpResponse.json({
          custom: false,
          available: [{ key: "recipes.recent", default: true }],
          widgets: [
            {
              key: "recipes.recent",
              data: {
                recipes: [
                  {
                    id: recipe.id,
                    title: "Tarte aux pommes",
                    imageUrl: null,
                    author: s.me.username,
                    isBase: false,
                    adapted: false,
                    spaceId: s.space.id,
                    spaceName: s.space.name,
                  },
                ],
              },
            },
          ],
        })
      )
    );
    renderWithProviders(<App />, { route: `/s/${s.personal.id}/home` });
    const card = await screen.findByRole("article", { name: "Tarte aux pommes" });
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    const sheet = await screen.findByRole("dialog", { name: "Tarte aux pommes" });
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    await within(sheet).findByRole("button", { name: "Voir l'historique" });
    expect(
      screen.queryByRole("heading", { level: 1, name: "Tarte aux pommes" })
    ).not.toBeInTheDocument();
  });
});
