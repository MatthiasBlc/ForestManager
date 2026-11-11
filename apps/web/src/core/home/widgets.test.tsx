// Widgets d'accueil et feuille "Personnaliser l'accueil" (C6b.3) [D60, D193].
import type { HomeResponse } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

const RECIPE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function isoDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Faux GET /me/home et PATCH /me/preferences (relu apres chaque choix). */
function homeServer(initial: HomeResponse) {
  let body = initial;
  const patches: unknown[] = [];
  server.use(
    http.get("/api/v1/me/home", () => HttpResponse.json(body)),
    http.patch("/api/v1/me/preferences", async ({ request }) => {
      const patch = (await request.json()) as { homeWidgets: string[] | null };
      patches.push(patch.homeWidgets);
      const keys = patch.homeWidgets ?? body.available.filter((w) => w.default).map((w) => w.key);
      body = {
        ...body,
        custom: patch.homeWidgets !== null,
        widgets: keys.map((key) => ({ key, data: dataOf(key) })),
      };
      return HttpResponse.json(buildMe());
    })
  );
  return patches;
}

function dataOf(key: string): Record<string, unknown> {
  return key === "core.activity" ? { events: [] } : (WIDGETS[key] ?? {});
}

const famille = buildSpaceDetail({ name: "Famille" });

const WIDGETS: Record<string, Record<string, unknown>> = {
  "meal-plan.upcoming": {
    spaces: [
      {
        spaceId: famille.id,
        spaceName: "Famille",
        meals: [{ date: isoDay(1), mealTime: "LUNCH", title: "Gratin", recipeId: RECIPE_ID }],
      },
    ],
  },
  "meal-plan.most-cooked": {
    recipes: [
      { id: RECIPE_ID, title: "Dahl corail", count: 9, spaceId: famille.id, spaceName: "Famille" },
    ],
  },
  "recipes.recent": {
    recipes: [
      {
        id: RECIPE_ID,
        title: "Tarte aux pommes",
        imageUrl: null,
        author: "sam",
        isBase: false,
        adapted: false,
        spaceId: famille.id,
        spaceName: "Famille",
      },
    ],
  },
};

const AVAILABLE = [
  { key: "meal-plan.upcoming", default: true },
  { key: "meal-plan.most-cooked", default: true },
  { key: "recipes.recent", default: true },
  { key: "core.activity", default: false },
];

function defaults(): HomeResponse {
  return {
    widgets: ["meal-plan.upcoming", "meal-plan.most-cooked", "recipes.recent"].map((key) => ({
      key,
      data: dataOf(key),
    })),
    available: AVAILABLE,
    custom: false,
  };
}

/** Session d'abord : ses handlers par defaut passent apres ceux de l'accueil. */
function renderHome(response: HomeResponse) {
  const me = buildMe({ username: "matthias" });
  mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
  const patches = homeServer(response);
  return { ...renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` }), patches };
}

describe("widgets d'accueil (E-ACCUEIL)", () => {
  it("affiche les widgets choisis dans l'ordre, avec leurs donnees", async () => {
    renderHome(defaults());
    const titles = await screen.findAllByRole("heading", { level: 2 });
    expect(titles.map((h) => h.textContent)).toEqual([
      "Prochains repas",
      "Tes recettes les plus cuisinées",
      "Récemment ajoutées dans tes espaces",
    ]);
    const meals = screen.getByRole("region", { name: "Prochains repas" });
    expect(within(meals).getByText("Famille")).toBeInTheDocument();
    expect(within(meals).getByRole("button", { name: /Demain, midi.*Gratin/ })).toBeInTheDocument();
    const cooked = screen.getByRole("region", { name: "Tes recettes les plus cuisinées" });
    expect(within(cooked).getByRole("link", { name: /Dahl corail.*9 fois/ })).toHaveAttribute(
      "href",
      `/s/${famille.id}/recipes/${RECIPE_ID}`
    );
    const recent = screen.getByRole("region", { name: "Récemment ajoutées dans tes espaces" });
    expect(within(recent).getByRole("article", { name: "Tarte aux pommes" })).toBeInTheDocument();
  });

  it("montre l'etat vide d'un widget sans donnees", async () => {
    renderHome({
      widgets: [{ key: "recipes.recent", data: { recipes: [] } }],
      available: [{ key: "recipes.recent", default: true }],
      custom: false,
    });
    expect(await screen.findByText(/Aucune recette ajoutée récemment/)).toBeInTheDocument();
  });

  it("personnalise l'accueil : activer, deplacer, retablir par defaut", async () => {
    const { user, patches } = renderHome(defaults());
    await user.click(await screen.findByRole("button", { name: "Personnaliser l'accueil" }));
    const sheet = await screen.findByRole("dialog", { name: "Personnaliser l'accueil" });

    await user.click(within(sheet).getByRole("switch", { name: "Activité des groupes" }));
    await waitFor(() => {
      expect(patches.at(-1)).toEqual([
        "meal-plan.upcoming",
        "meal-plan.most-cooked",
        "recipes.recent",
        "core.activity",
      ]);
    });

    await user.click(
      within(sheet).getByRole("button", { name: "Monter Récemment ajoutées dans tes espaces" })
    );
    await waitFor(() => {
      expect(patches.at(-1)).toEqual([
        "meal-plan.upcoming",
        "recipes.recent",
        "meal-plan.most-cooked",
        "core.activity",
      ]);
    });

    await user.click(within(sheet).getByRole("button", { name: "Rétablir par défaut" }));
    await waitFor(() => {
      expect(patches.at(-1)).toBeNull();
    });
  });
});
