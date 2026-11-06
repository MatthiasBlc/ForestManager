// Adaptation (C3.6) : F-ADAPTER, badge "Original modifie", E-COMPARER-ORIGINAL [D17, D105].
import type { RecipeComparison } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildSpaceDetail, contentView, unitId, uuid } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  localStorage.clear();
});

const lea = { id: uuid(), username: "lea", avatarUrl: null };
const foyer = { id: uuid(), name: "Foyer" };

describe("adapter pour un espace (F-ADAPTER)", () => {
  it("choisir l'espace, creer l'adaptation et ouvrir l'editeur", async () => {
    const amis = buildSpaceDetail({ name: "Amis", tintIndex: 4, myRole: "MEMBER" });
    const s = recipeServer({ extraSpaces: [amis] });
    const recipe = s.add({
      title: "Gratin de pâtes",
      author: lea,
      can: { edit: false, delete: false, share: false },
    });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Adapter pour un espace" }));
    const sheet = await screen.findByRole("dialog", { name: "Adapter pour un espace" });
    expect(within(sheet).getByText(/L'original de lea n'est jamais modifié/)).toBeInTheDocument();
    const targets = within(sheet).getByRole("group", { name: "Espace de l'adaptation" });
    expect(within(targets).getByRole("button", { name: "Famille" })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(targets).getByRole("button", { name: "Amis" }));
    await user.click(within(sheet).getByRole("button", { name: "Créer et modifier l'adaptation" }));
    await waitFor(() => {
      expect(s.recipes.bodies.adapt).toEqual({ targetSpaceId: amis.id });
    });
    expect(await screen.findByLabelText("Titre")).toHaveValue("Gratin de pâtes");
    expect(screen.getByText("Adaptation créée dans Amis")).toBeInTheDocument();
  });
});

describe("adaptation et original (E-COMPARER-ORIGINAL)", () => {
  function adaptation(s: ReturnType<typeof recipeServer>, changed: boolean, deleted = false) {
    return s.add({
      title: "Gratin au beurre",
      adaptedFrom: {
        id: uuid(),
        title: "Gratin de pâtes",
        author: lea,
        homeSpace: foyer,
        deleted,
        changed,
      },
    });
  }

  it("badge Original modifie, comparaison en deux parties, marquer comme vu", async () => {
    const s = recipeServer();
    const recipe = adaptation(s, true);
    const base = contentView(recipe, { title: "Gratin de pâtes", cookMinutes: 25 });
    const butter = {
      ingredientId: uuid(),
      name: "Beurre",
      namePlural: null,
      quantity: 10,
      unitId: unitId("g"),
      note: null,
      optional: false,
    };
    const comparison: RecipeComparison = {
      original: {
        id: recipe.adaptedFrom!.id,
        title: "Gratin de pâtes",
        author: lea,
        homeSpace: foyer,
        deleted: false,
        currentRevision: 3,
        lastChange: { at: "2026-11-02T10:00:00.000Z", by: lea },
      },
      baseRevision: 2,
      base,
      current: { ...base, cookMinutes: 35 },
      adaptation: {
        ...base,
        title: "Gratin au beurre",
        blocks: base.blocks.map((block) =>
          block.kind === "LOCAL" ? { ...block, ingredients: [...block.ingredients, butter] } : block
        ),
      },
      canMarkSeen: true,
    };
    s.recipes.comparisons[recipe.id] = comparison;
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    expect(
      await screen.findByText(/Adaptée de Gratin de pâtes · lea \(Foyer\)/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Comparer avec l'original" }));

    const changed = await screen.findByRole("region", { name: "Original modifié" });
    expect(within(changed).getByText(/le 2 novembre, par lea/)).toBeInTheDocument();
    const cook = within(changed).getByRole("row", { name: /Cuisson/ });
    expect(within(cook).getByText("25 min")).toBeInTheDocument();
    expect(within(cook).getByText("35 min")).toBeInTheDocument();

    const mine = screen.getByRole("region", { name: "Ce que Famille a changé" });
    expect(within(mine).getByRole("row", { name: /Titre/ })).toBeInTheDocument();
    expect(
      within(within(mine).getByRole("row", { name: /Ingrédient/ })).getByText("10 g Beurre")
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Marquer comme vu" }));
    await waitFor(() => {
      expect(s.state.calls).toContain(`seen:${recipe.id}`);
    });
    expect(await screen.findByText("Marqué comme vu")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Gratin au beurre", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Comparer avec l'original" })
    ).not.toBeInTheDocument();
  });

  it("original supprime : l'adaptation vit seule", async () => {
    const s = recipeServer();
    const recipe = adaptation(s, false, true);
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}` });
    expect(await screen.findByText(/Original supprimé/)).toBeInTheDocument();
    expect(screen.queryByText("Original modifié")).not.toBeInTheDocument();
  });
});
