// Planning (C5.2) : E-PLANNING (grille bureau, Jour / Semaine en mobile), F-REPAS,
// recherche de recette, "Pas de repas", vider, echange [D69, D111, D112, D180, D181].
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, toSummary } from "../../test/fixtures.ts";
import { buildMeal, mealPlanServer, recipeElsewhere } from "../../test/meal-plan-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

// Mardi 10 novembre 2026, 10 h (heure locale).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
  desktop(false);
});

/** Ecran large : grille semaine (sinon vues Jour / Semaine du mobile). */
function desktop(on = true) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: on && query.includes("min-width"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

const route = (spaceId: string) => `/s/${spaceId}/meal-plan`;

describe("E-PLANNING en bureau : grille semaine", () => {
  it("montre la semaine du lundi au dimanche, midi et soir, avec ses repas", async () => {
    desktop();
    const s = mealPlanServer({
      meals: [
        buildMeal({
          date: "2026-11-10",
          mealTime: "DINNER",
          kind: "RECIPE",
          title: "Dahl",
          servings: 6,
          locked: true,
        }),
        buildMeal({ date: "2026-11-12", mealTime: "LUNCH", title: "Cantine" }),
        buildMeal({ date: "2026-11-13", mealTime: "DINNER", kind: "SKIPPED", title: null }),
      ],
    });
    const { container } = renderWithProviders(<App />, { route: route(s.space.id) });
    expect(
      await screen.findByRole("heading", { name: "Semaine du 9 au 15 novembre" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Mardi 10, soir : Dahl, 6 pers., verrouillé" })
    ).toBeInTheDocument();
    expect(s.plan.reads.at(-1)).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(screen.getByRole("button", { name: "Jeudi 12, midi : Cantine" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vendredi 13, soir : Pas de repas" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lundi 9, midi : Ajouter un repas" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^\p{L}+ \d+, (midi|soir) : /u })).toHaveLength(
      14
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("navigue de semaine en semaine et revient a aujourd'hui", async () => {
    desktop();
    const s = mealPlanServer();
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await screen.findByRole("heading", { name: "Semaine du 9 au 15 novembre" });
    await user.click(screen.getByRole("button", { name: "Semaine suivante" }));
    expect(
      await screen.findByRole("heading", { name: "Semaine du 16 au 22 novembre" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(s.plan.reads.at(-1)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    });
    await user.click(screen.getByRole("button", { name: "Semaine précédente" }));
    await user.click(screen.getByRole("button", { name: "Semaine précédente" }));
    await screen.findByRole("heading", { name: "Semaine du 2 au 8 novembre" });
    await user.click(screen.getByRole("button", { name: "Aujourd'hui" }));
    await screen.findByRole("heading", { name: "Semaine du 9 au 15 novembre" });
  });

  it("la semaine commence le jour choisi dans les reglages, sans le midi si l'espace ne le planifie pas", async () => {
    desktop();
    const s = mealPlanServer({ settings: { weekStartsOn: "SUN", mealTimes: ["DINNER"] } });
    renderWithProviders(<App />, { route: route(s.space.id) });
    await screen.findByRole("heading", { name: "Semaine du 8 au 14 novembre" });
    expect(await screen.findAllByRole("button", { name: /: Ajouter un repas/ })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /midi/ })).not.toBeInTheDocument();
  });

  it("glisser un repas sur un autre les echange", async () => {
    desktop();
    const s = mealPlanServer({
      meals: [buildMeal({ date: "2026-11-10", mealTime: "LUNCH", title: "Soupe" })],
    });
    renderWithProviders(<App />, { route: route(s.space.id) });
    const from = await screen.findByRole("button", { name: "Mardi 10, midi : Soupe" });
    const to = screen.getByRole("button", { name: "Jeudi 12, soir : Ajouter un repas" });
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "move",
      dropEffect: "move",
    };
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });
    await waitFor(() => {
      expect(s.plan.swaps).toEqual([
        {
          a: { date: "2026-11-10", mealTime: "LUNCH" },
          b: { date: "2026-11-12", mealTime: "DINNER" },
        },
      ]);
    });
    expect(
      await screen.findByRole("button", { name: "Jeudi 12, soir : Soupe" })
    ).toBeInTheDocument();
  });
});

describe("E-PLANNING en mobile : Jour et Semaine (D111)", () => {
  it("vue Jour par defaut sur aujourd'hui ; un autre jour se choisit dans le bandeau", async () => {
    const s = mealPlanServer({
      meals: [
        buildMeal({ date: "2026-11-10", mealTime: "LUNCH", title: "Cantine" }),
        buildMeal({ date: "2026-11-11", mealTime: "DINNER", title: "Pizza" }),
      ],
    });
    const { user, container } = renderWithProviders(<App />, { route: route(s.space.id) });
    expect(await screen.findByRole("heading", { name: "Mardi 10 novembre" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Mardi 10, midi : Cantine" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mardi 10, soir : Ajouter un repas" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MAR 10/ })).toHaveAttribute("aria-current", "date");
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: /MER 11/ }));
    expect(
      await screen.findByRole("heading", { name: "Mercredi 11 novembre" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mercredi 11, soir : Pizza" })).toBeInTheDocument();
  });

  it("vue Semaine : une ligne par jour, toucher un repas l'ouvre", async () => {
    const s = mealPlanServer({
      meals: [buildMeal({ date: "2026-11-12", mealTime: "LUNCH", title: "Cantine" })],
    });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(await screen.findByRole("button", { name: "Semaine" }));
    expect(await screen.findByRole("heading", { name: "Du 9 au 15 novembre" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Jeudi 12, midi : Cantine" }));
    expect(await screen.findByRole("dialog", { name: "Jeudi 12, midi" })).toBeInTheDocument();
  });
});

describe("F-REPAS", () => {
  it("texte libre avec commentaire, portions et verrou", async () => {
    const s = mealPlanServer();
    const { user, container } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(
      await screen.findByRole("button", { name: "Mardi 10, soir : Ajouter un repas" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, soir" });
    await user.click(within(sheet).getByRole("button", { name: "Texte libre" }));
    await user.type(within(sheet).getByLabelText("Repas"), "Resto japonais");
    await user.type(within(sheet).getByLabelText("Commentaire"), "Réserver");
    await user.click(within(sheet).getByRole("button", { name: "Plus" }));
    await user.click(within(sheet).getByRole("switch", { name: /Verrouiller/ }));
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.puts).toEqual([
        {
          date: "2026-11-10",
          mealTime: "DINNER",
          kind: "TEXT",
          text: "Resto japonais",
          comment: "Réserver",
          servings: 5,
          locked: true,
        },
      ]);
    });
    expect(
      await screen.findByRole("button", {
        name: "Mardi 10, soir : Resto japonais, 5 pers., verrouillé",
      })
    ).toBeInTheDocument();
  });

  it("recette de l'espace trouvee par la recherche ; portions par defaut non envoyees", async () => {
    const dahl = toSummary(buildRecipe({ title: "Dahl de lentilles" }));
    const s = mealPlanServer({ spaceRecipes: [dahl] });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(
      await screen.findByRole("button", { name: "Mardi 10, midi : Ajouter un repas" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Recette" }), "dahl");
    await user.click(await within(sheet).findByRole("option", { name: /Dahl de lentilles/ }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.puts.at(-1)).toEqual({
        date: "2026-11-10",
        mealTime: "LUNCH",
        kind: "RECIPE",
        recipeId: dahl.id,
        comment: null,
        servings: null,
        locked: false,
      });
    });
  });

  it("une de mes recettes hors de l'espace y est d'abord partagee", async () => {
    const curry = recipeElsewhere("Curry de pois chiches");
    const s = mealPlanServer({ myRecipes: [curry] });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(
      await screen.findByRole("button", { name: "Mardi 10, midi : Ajouter un repas" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Recette" }), "curry");
    const option = await within(sheet).findByRole("option", { name: /Curry de pois chiches/ });
    expect(option).toHaveTextContent("Partagée dans Famille en l'ajoutant");
    await user.click(option);
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.puts.at(-1)).toMatchObject({ kind: "RECIPE", recipeId: curry.id });
    });
    expect(s.plan.shareRequests).toEqual([{ recipeId: curry.id, targetSpaceId: s.space.id }]);
  });

  it("partage en attente de l'auteur : le repas est note en texte", async () => {
    const curry = recipeElsewhere("Curry de pois chiches");
    const s = mealPlanServer({ myRecipes: [curry], shareResult: "PENDING" });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(
      await screen.findByRole("button", { name: "Mardi 10, midi : Ajouter un repas" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Recette" }), "curry");
    await user.click(await within(sheet).findByRole("option", { name: /Curry de pois chiches/ }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.puts.at(-1)).toMatchObject({ kind: "TEXT", text: "Curry de pois chiches" });
    });
    expect(await screen.findByText(/Demande de partage envoyée/)).toBeInTheDocument();
  });

  it('"Pas de repas" puis vider le repas', async () => {
    const s = mealPlanServer({
      meals: [buildMeal({ date: "2026-11-10", mealTime: "LUNCH", title: "Soupe" })],
    });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(await screen.findByRole("button", { name: "Mardi 10, midi : Soupe" }));
    let sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    expect(within(sheet).getByLabelText("Repas")).toHaveValue("Soupe");
    await user.click(within(sheet).getByRole("button", { name: "Pas de repas" }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.plan.puts.at(-1)).toEqual({
        date: "2026-11-10",
        mealTime: "LUNCH",
        kind: "SKIPPED",
      });
    });

    await user.click(await screen.findByRole("button", { name: "Mardi 10, midi : Pas de repas" }));
    sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    await user.click(within(sheet).getByRole("button", { name: "Vider le repas" }));
    await waitFor(() => {
      expect(s.plan.clears).toEqual([{ date: "2026-11-10", mealTime: "LUNCH" }]);
    });
    expect(
      await screen.findByRole("button", { name: "Mardi 10, midi : Ajouter un repas" })
    ).toBeInTheDocument();
  });

  it("recette devenue invisible : affichee en texte avec une mention", async () => {
    const s = mealPlanServer({
      meals: [
        buildMeal({
          date: "2026-11-10",
          mealTime: "LUNCH",
          kind: "RECIPE",
          title: "Curry",
          recipe: null,
        }),
      ],
    });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(await screen.findByRole("button", { name: "Mardi 10, midi : Curry" }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    expect(within(sheet).getByText(/n'est plus disponible dans Famille/)).toBeInTheDocument();
  });
});

describe("echanger sur mobile (D112)", () => {
  it("mode echange : bandeau, toucher la cible, Annuler", async () => {
    const s = mealPlanServer({
      meals: [buildMeal({ date: "2026-11-10", mealTime: "LUNCH", title: "Soupe" })],
    });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    await user.click(await screen.findByRole("button", { name: "Mardi 10, midi : Soupe" }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    await user.click(within(sheet).getByRole("button", { name: "Échanger avec un autre repas" }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Touche le repas qui prend la place de « Soupe »");
    await user.click(within(banner).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mardi 10, midi : Soupe" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Mardi 10, midi" })).getByRole("button", {
        name: "Échanger avec un autre repas",
      })
    );
    await user.click(await screen.findByRole("button", { name: /MER 11/ }));
    await user.click(
      await screen.findByRole("button", { name: "Mercredi 11, soir : Déplacer ici" })
    );
    await waitFor(() => {
      expect(s.plan.swaps).toEqual([
        {
          a: { date: "2026-11-10", mealTime: "LUNCH" },
          b: { date: "2026-11-11", mealTime: "DINNER" },
        },
      ]);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("lecture seule (F-MPL-3)", () => {
  it("sans le droit de modifier : mention, repas consultable sans formulaire", async () => {
    const s = mealPlanServer({
      settings: { editRole: "MODERATOR" },
      meals: [
        buildMeal({
          date: "2026-11-10",
          mealTime: "LUNCH",
          kind: "RECIPE",
          title: "Dahl",
          recipe: { id: "00000000-0000-4000-8000-0000000000aa", imageUrl: null },
          comment: "Sans coriandre",
        }),
      ],
    });
    const { user } = renderWithProviders(<App />, { route: route(s.space.id) });
    expect(
      await screen.findByText("Seuls les modérateurs et le propriétaire modifient les repas.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter un repas/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Mardi 10, midi : Dahl" }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, midi" });
    expect(within(sheet).getByText("Sans coriandre")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Voir la recette" })).toHaveAttribute(
      "href",
      `/s/${s.space.id}/recipes/00000000-0000-4000-8000-0000000000aa`
    );
    expect(within(sheet).queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });
});
