// Liste de courses (C9 etape 4b) : "Depuis le planning" [D228]. Periode par defaut de
// demain a la fin de la semaine du planning, apercu additionne et range par section,
// tout coche sauf le facultatif, deja dans la liste signale, puis "Ajouter N articles".
// Meme feuille depuis la barre du planning, sur la semaine affichee.
import type { PlanPreview, PlanPreviewLine } from "@fm/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { unitId } from "../../test/fixtures.ts";
import { mealPlanServer } from "../../test/meal-plan-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { buildItem, buildSection, shoppingServer } from "../../test/shopping-server.ts";

// Mardi 10 novembre 2026 : semaine du lundi 9 au dimanche 15.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

const primeur = buildSection("Primeur");
const alimentaire = buildSection("Alimentaire");

const POTATO = "00000000-0000-4000-8000-00000000d001";
const ZUCCHINI = "00000000-0000-4000-8000-00000000d002";
const SALT = "00000000-0000-4000-8000-00000000d003";
const PARSLEY = "00000000-0000-4000-8000-00000000d004";

function line(
  id: string,
  name: string,
  over: Partial<PlanPreviewLine> & { recipe?: string } = {}
): PlanPreviewLine {
  const { recipe = "Hachis parmentier", ...rest } = over;
  return {
    ingredient: { id, name, namePlural: null },
    sectionId: null,
    parts: [],
    optional: false,
    toCheck: false,
    inList: null,
    sources: [
      {
        mealSlotId: null,
        recipeId: null,
        recipeTitle: recipe,
        date: "2026-11-12",
        mealTime: "DINNER",
        parts: rest.parts ?? [],
      },
    ],
    ...rest,
  };
}

const PREVIEW: PlanPreview = {
  lines: [
    line(POTATO, "pommes de terre", {
      sectionId: primeur.id,
      parts: [{ quantity: 1.2, unitId: unitId("kg") }],
    }),
    line(ZUCCHINI, "courgettes", {
      sectionId: primeur.id,
      parts: [{ quantity: 400, unitId: unitId("g") }],
      inList: [{ quantity: 600, unitId: unitId("g") }],
    }),
    line(PARSLEY, "persil", { sectionId: primeur.id, optional: true }),
    line(SALT, "sel", { sectionId: null }),
  ],
  addedMeals: [{ date: "2026-11-11", mealTime: "DINNER", title: "Gratin" }],
  skippedMeals: [
    { date: "2026-11-12", mealTime: "LUNCH", title: "Restes" },
    { date: "2026-11-13", mealTime: "DINNER", title: "Pizza commandée" },
  ],
  missingSubRecipes: [{ title: "Pâte brisée", inRecipe: "Quiche" }],
};

function planServer(options: Parameters<typeof shoppingServer>[0] = {}) {
  return shoppingServer({
    sections: [primeur, alimentaire],
    items: [buildItem({ sectionId: primeur.id, label: "Avocats" })],
    mealPlan: {},
    preview: PREVIEW,
    ...options,
  });
}

const route = (s: { space: { id: string } }) => `/s/${s.space.id}/shopping`;

async function openSheet(s: { space: { id: string } }) {
  const { user, container } = renderWithProviders(<App />, { route: route(s) });
  await user.click(await screen.findByRole("button", { name: "Depuis le planning" }));
  const sheet = await screen.findByRole("dialog", { name: "Depuis le planning" });
  return { user, container, sheet };
}

describe("Depuis le planning, depuis la liste", () => {
  it("periode par defaut : de demain a la fin de la semaine du planning", async () => {
    const s = planServer();
    const { sheet } = await openSheet(s);
    expect(within(sheet).getByLabelText("Du")).toHaveValue("2026-11-11");
    expect(within(sheet).getByLabelText("Au")).toHaveValue("2026-11-15");
    await waitFor(() => {
      expect(s.shop.previews).toEqual([{ from: "2026-11-11", to: "2026-11-15" }]);
    });
  });

  it("la semaine du planning suit son premier jour", async () => {
    const s = planServer({ mealPlan: { settings: { weekStartsOn: "SUN" } } });
    const { sheet } = await openSheet(s);
    // Semaine du dimanche 8 au samedi 14.
    expect(within(sheet).getByLabelText("Au")).toHaveValue("2026-11-14");
  });

  it("apercu range par section, tout coche sauf le facultatif, deja dans la liste signale", async () => {
    const s = planServer();
    const { sheet, container } = await openSheet(s);
    const fresh = await within(sheet).findByRole("group", { name: "Primeur" });
    const boxes = within(fresh).getAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("aria-label"))).toEqual([
      "pommes de terre",
      "courgettes",
      "persil",
    ]);
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, false]);
    expect(within(fresh).getByText("1,2 kg")).toBeInTheDocument();
    expect(within(fresh).getByText("déjà 600 g dans la liste")).toBeInTheDocument();
    expect(within(fresh).getByText("+ 400 g")).toBeInTheDocument();
    expect(within(fresh).getByText(/facultatif/)).toBeInTheDocument();
    const others = within(sheet).getByRole("group", { name: "Autres" });
    expect(within(others).getByRole("checkbox", { name: "sel" })).toBeChecked();
    expect(within(others).getByText(/à goût/)).toBeInTheDocument();

    // Repas sans recette, deja ajoutes, sous-recettes manquantes.
    expect(
      within(sheet).getByText("2 repas sans recette : Restes, Pizza commandée")
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(/Gratin \(Mercredi 11, soir\) : déjà ajouté/)
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("Pâte brisée (dans Quiche) : ingrédients manquants")
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("decocher puis Ajouter N articles : les lignes cochees partent, la feuille se ferme", async () => {
    const s = planServer({ applyResult: { added: 1, updated: 1 } });
    const { user, sheet } = await openSheet(s);
    const add = await within(sheet).findByRole("button", { name: "Ajouter 3 articles" });
    await user.click(within(sheet).getByRole("checkbox", { name: "pommes de terre" }));
    expect(add).toHaveAccessibleName("Ajouter 2 articles");
    await user.click(add);
    await waitFor(() => {
      expect(s.shop.applied).toEqual([
        { from: "2026-11-11", to: "2026-11-15", ingredientIds: [ZUCCHINI, SALT] },
      ]);
    });
    expect(await screen.findByText("1 article ajouté et 1 complété")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Depuis le planning" })).not.toBeInTheDocument();
    });
  });

  it("changer la periode relance l'apercu ; une periode invalide est expliquee", async () => {
    const s = planServer();
    const { sheet } = await openSheet(s);
    await within(sheet).findByRole("group", { name: "Primeur" });
    fireEvent.change(within(sheet).getByLabelText("Au"), { target: { value: "2026-11-20" } });
    await waitFor(() => {
      expect(s.shop.previews.at(-1)).toEqual({ from: "2026-11-11", to: "2026-11-20" });
    });
    fireEvent.change(within(sheet).getByLabelText("Au"), { target: { value: "2026-11-01" } });
    expect(await within(sheet).findByText("La période va de 1 à 31 jours.")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Ajouter/ })).toBeDisabled();
    expect(s.shop.previews).toHaveLength(2);
  });

  it("rien a acheter sur la periode", async () => {
    const s = planServer({
      preview: { lines: [], addedMeals: [], skippedMeals: [], missingSubRecipes: [] },
    });
    const { sheet } = await openSheet(s);
    expect(await within(sheet).findByText("Rien à acheter sur cette période")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Rien à ajouter" })).toBeDisabled();
  });

  it("sans module planning : pas d'entree", async () => {
    const s = shoppingServer({ items: [buildItem({ label: "Lait" })] });
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Lait" });
    expect(screen.queryByRole("button", { name: "Depuis le planning" })).not.toBeInTheDocument();
  });

  it("sans le droit de modifier : pas d'entree", async () => {
    const s = planServer({ myRole: "MEMBER", editRole: "MODERATOR" });
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Avocats" });
    expect(screen.queryByRole("button", { name: "Depuis le planning" })).not.toBeInTheDocument();
  });
});

describe("Depuis le planning, depuis la barre du planning", () => {
  it("meme feuille, sur la semaine affichee", async () => {
    const s = planServer();
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan?day=2026-11-18`,
    });
    await user.click(await screen.findByRole("button", { name: "Ajouter à la liste de courses" }));
    const sheet = await screen.findByRole("dialog", { name: "Depuis le planning" });
    expect(within(sheet).getByLabelText("Du")).toHaveValue("2026-11-16");
    expect(within(sheet).getByLabelText("Au")).toHaveValue("2026-11-22");
  });

  it("semaine en cours : a partir de demain", async () => {
    const s = planServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Ajouter à la liste de courses" }));
    const sheet = await screen.findByRole("dialog", { name: "Depuis le planning" });
    expect(within(sheet).getByLabelText("Du")).toHaveValue("2026-11-11");
    expect(within(sheet).getByLabelText("Au")).toHaveValue("2026-11-15");
  });

  it("sans module Courses : pas d'entree", async () => {
    const s = mealPlanServer();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await screen.findByRole("button", { name: "Semaine suivante" });
    expect(
      screen.queryByRole("button", { name: "Ajouter à la liste de courses" })
    ).not.toBeInTheDocument();
  });
});
