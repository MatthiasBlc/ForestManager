// Recherche globale et CommandPalette (C6b.1) [P16, D119, D191].
import type { SearchGroup } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { CommandPalette } from "../../ui/command-palette.tsx";
import { buildRecipe } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { pushRecentRecipe } from "./recent.ts";

/** Faux `GET /search` : renvoie `groups` et garde les requetes recues. */
function searchServer(groups: (q: string) => SearchGroup[]) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get("/api/v1/search", ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push(params);
      return HttpResponse.json({ groups: groups(params.get("q") ?? "") });
    })
  );
  return queries;
}

describe("CommandPalette (design system)", () => {
  const groups = [
    {
      id: "a",
      label: "Recettes",
      items: [
        { id: "r1", label: "Gratin", icon: "book-open" as const, hint: "Famille" },
        { id: "r2", label: "Gratin froid", icon: "book-open" as const },
      ],
    },
    {
      id: "b",
      label: "Actions",
      items: [{ id: "x1", label: "Nouvelle recette", icon: "plus" as const }],
    },
  ];

  it("navigue aux fleches entre les groupes et ouvre par Entree", async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(
      <CommandPalette
        open
        onClose={() => undefined}
        query=""
        onQueryChange={() => undefined}
        groups={groups}
        onSelect={onSelect}
      />
    );
    const input = screen.getByRole("combobox", { name: "Rechercher" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("option", { name: "Gratin, Famille" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Nouvelle recette" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("x1");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("r1");
  });

  it("se ferme par Echap et affiche le message quand rien n'est trouve", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <CommandPalette
        open
        onClose={onClose}
        query="zz"
        onQueryChange={() => undefined}
        groups={[]}
        empty="Rien trouvé pour « zz »"
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText("Rien trouvé pour « zz »")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("recherche globale (F-RECHERCHE)", () => {
  it("s'ouvre par Ctrl K et propose les actions et les recettes recentes sans appel", async () => {
    const s = recipeServer({ myRole: "OWNER" });
    const queries = searchServer(() => []);
    pushRecentRecipe({ id: "rc1", title: "Dahl corail", spaceId: s.space.id });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("heading", { name: /Pas encore de recette/ });

    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Recherche" });
    expect(within(dialog).getByRole("option", { name: "Nouvelle recette" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Inviter quelqu'un" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /Dahl corail/ })).toBeInTheDocument();
    expect(queries).toHaveLength(0);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Recherche" })).not.toBeInTheDocument();
    });
  });

  it("filtre les actions par le texte tape, sans appel en dessous de 2 caracteres", async () => {
    const s = recipeServer({ myRole: "MEMBER" });
    const queries = searchServer(() => []);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click(await screen.findByRole("button", { name: /Rechercher une recette/ }));
    const dialog = await screen.findByRole("dialog", { name: "Recherche" });
    // Un simple membre n'invite pas.
    expect(within(dialog).queryByRole("option", { name: "Inviter quelqu'un" })).toBeNull();

    await user.type(within(dialog).getByRole("combobox"), "p");
    expect(queries).toHaveLength(0);
    await user.type(within(dialog).getByRole("combobox"), "rof");
    expect(await within(dialog).findByRole("option", { name: "Mon profil" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "Nouvelle recette" })).toBeNull();
  });

  it("montre les groupes de l'API et ouvre une recette dans son espace", async () => {
    const gratin = buildRecipe({ title: "Gratin dauphinois" });
    const s = recipeServer({ recipes: [gratin] });
    const queries = searchServer((q) =>
      q === "grat"
        ? [
            {
              key: "recipes.recipes",
              items: [
                {
                  id: gratin.id,
                  title: "Gratin dauphinois",
                  spaceId: s.space.id,
                  spaceName: "Famille",
                  data: { isBase: true, adapted: false },
                },
              ],
            },
            {
              key: "core.members",
              items: [
                {
                  id: "5f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f",
                  title: "gratien",
                  spaceId: s.space.id,
                  spaceName: "Famille",
                  data: {},
                },
              ],
            },
          ]
        : []
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await screen.findByRole("heading", { name: "Membres de Famille" });
    await user.keyboard("{Meta>}k{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Recherche" });
    await user.type(within(dialog).getByRole("combobox"), "grat");

    const recipe = await within(dialog).findByRole("option", { name: /Gratin dauphinois/ });
    expect(recipe).toHaveTextContent("Famille · base");
    expect(within(dialog).getByRole("listbox", { name: "Membres" })).toBeInTheDocument();
    expect(queries.at(-1)?.get("spaceId")).toBe(s.space.id);

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Gratin dauphinois" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Recherche" })).not.toBeInTheDocument();
  });

  it("un ingredient ouvre la liste de l'espace filtree sur lui", async () => {
    const s = recipeServer({ recipes: [buildRecipe({ title: "Gratin" })] });
    searchServer(() => [
      {
        key: "recipes.ingredients",
        items: [
          {
            id: "8a3c1e52-7b9d-4f0a-8c2e-1d3f5a7b9c0e",
            title: "Pâtes",
            spaceId: s.space.id,
            spaceName: "Famille",
            data: { recipeCount: 2 },
          },
        ],
      },
    ]);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await screen.findByRole("heading", { name: "Membres de Famille" });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Recherche" });
    await user.type(within(dialog).getByRole("combobox"), "pate");
    await user.click(await within(dialog).findByRole("option", { name: /Pâtes.*2 recettes/ }));

    expect(
      await screen.findByRole("button", { name: "Retirer le filtre Pâtes" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("ingredientIds")).toBe(
        "8a3c1e52-7b9d-4f0a-8c2e-1d3f5a7b9c0e"
      );
    });
    await user.click(screen.getByRole("button", { name: "Retirer le filtre Pâtes" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("ingredientIds")).toBeNull();
    });
  });

  it("une action ouvre sa feuille par l'adresse (inviter)", async () => {
    const s = recipeServer({ myRole: "OWNER" });
    searchServer(() => []);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("heading", { name: /Pas encore de recette/ });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Recherche" });
    await user.type(within(dialog).getByRole("combobox"), "invit");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Inviter dans Famille" })).toBeInTheDocument();
  });
});
