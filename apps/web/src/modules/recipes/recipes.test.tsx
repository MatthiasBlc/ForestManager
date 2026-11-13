// Ecrans des recettes simples (C3.2) : liste, ajout, detail, edition, suppression.
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, unitId } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { mockUploads, photoFile } from "../../test/uploads.ts";

vi.mock("../../lib/image.ts", () => import("../../test/fake-image.ts"));

beforeEach(() => {
  localStorage.clear();
});

const drafts = () => Object.keys(localStorage).filter((key) => key.startsWith("fm:draft:"));

describe("liste des recettes (E-RECETTES)", () => {
  it("montre les recettes avec portions, temps et badges", async () => {
    const s = recipeServer({
      recipes: [
        buildRecipe({ title: "Gratin de pâtes", totalMinutes: 45 }),
        buildRecipe({ title: "Sauce teriyaki", isBase: true, totalMinutes: 10, yieldQuantity: 2 }),
      ],
    });
    const { container } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const card = await screen.findByRole("article", { name: "Gratin de pâtes" });
    expect(within(card).getByText("4 pers. · 45 min")).toBeInTheDocument();
    const sauce = screen.getByRole("article", { name: "Sauce teriyaki" });
    expect(within(sauce).getByText("Base")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("espace vide : invitation a creer la premiere recette", async () => {
    const s = recipeServer();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    expect(
      await screen.findByRole("heading", { name: "Pas encore de recette dans Famille" })
    ).toBeInTheDocument();
  });

  it("recherche et filtre par tag ou par base", async () => {
    const s = recipeServer({
      recipes: [buildRecipe({ title: "Gratin de pâtes" }), buildRecipe({ title: "Dahl" })],
    });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("article", { name: "Dahl" });
    await user.type(screen.getByRole("searchbox", { name: "Rechercher une recette" }), "gratin");
    await waitFor(() => {
      expect(screen.queryByRole("article", { name: "Dahl" })).not.toBeInTheDocument();
    });
    expect(s.recipes.queries.at(-1)?.get("q")).toBe("gratin");

    await user.click(screen.getByRole("button", { name: "Végétarien" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("tagIds")).toBe(s.recipes.globalTags[0]?.id);
    });
    await user.click(screen.getByRole("button", { name: "Bases" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("base")).toBe("true");
    });
  });

  it("Ajouter une recette > Creer > Saisir ouvre l'editeur (F-AJOUT-RECETTE)", async () => {
    const s = recipeServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click((await screen.findAllByRole("button", { name: "Ajouter une recette" }))[0]!);
    const root = screen.getByRole("dialog", { name: "Ajouter une recette dans Famille" });
    await user.click(within(root).getByRole("button", { name: /Créer/ }));
    const sheet = screen.getByRole("dialog", { name: "Créer une recette" });
    await user.click(within(sheet).getByRole("link", { name: /Saisir/ }));
    expect(await screen.findByLabelText("Titre")).toBeInTheDocument();
  });
});

describe("editeur de recette (E-RECETTE-EDITION)", () => {
  it("cree une recette : titre, portions, ingredient connu et nouveau, etape", async () => {
    const s = recipeServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    await user.type(await screen.findByLabelText("Titre"), "Gratin de Jeanne");
    await user.click(
      within(screen.getByRole("group", { name: "Portions" })).getByLabelText("Plus")
    );
    await user.type(screen.getByLabelText("Préparation (min)"), "15");

    const first = screen.getAllByRole("group", { name: "Ingrédient 1" })[0]!;
    await user.type(within(first).getByLabelText("Quantité"), "1,5");
    await user.selectOptions(within(first).getByLabelText("Unité"), "kg");
    await user.type(within(first).getByRole("combobox", { name: "Ingrédient" }), "pât");
    await user.click(await screen.findByRole("option", { name: "Pâtes" }));

    await user.click(screen.getByRole("button", { name: "Ajouter un ingrédient" }));
    const second = screen.getByRole("group", { name: "Ingrédient 2" });
    await user.type(within(second).getByRole("combobox", { name: "Ingrédient" }), "Gruyère");
    await user.selectOptions(within(second).getByLabelText("Unité"), "à goût");

    await user.type(screen.getByLabelText("Étape 1"), "Cuire les pâtes.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("heading", { name: "Gratin de Jeanne" })).toBeInTheDocument();
    expect(s.recipes.calls).toContain("ingredient:Gruyère");
    const pates = s.recipes.ingredients.find((i) => i.name === "Pâtes")!;
    expect(s.recipes.bodies.create).toMatchObject({
      title: "Gratin de Jeanne",
      yieldQuantity: 5,
      prepMinutes: 15,
      blocks: [
        {
          kind: "LOCAL",
          ingredients: [
            { ingredientId: pates.id, quantity: 1.5, unitId: unitId("kg") },
            { quantity: null, unitId: unitId("to-taste") },
          ],
          steps: ["Cuire les pâtes."],
        },
      ],
    });
    expect(drafts()).toEqual([]);
  });

  it("nouvelle recette : la photo choisie est rattachee apres l'enregistrement (D167)", async () => {
    const s = recipeServer();
    const { uploadIds } = mockUploads();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    await user.type(await screen.findByLabelText("Titre"), "Tarte");
    await user.upload(screen.getByLabelText("Ajouter la photo"), photoFile());
    expect(await screen.findByRole("img", { name: "Photo de la recette" })).toBeInTheDocument();
    expect(s.recipes.calls.filter((c) => c.startsWith("photo"))).toEqual([]);
    // Photo de recette : proportions gardees, pas de recadrage (D211).
    expect(screen.queryByRole("dialog", { name: "Recadrer la photo" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Étape 1"), "Cuire.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Tarte" })).toBeInTheDocument();
    expect(s.recipes.bodies.photo).toEqual({ uploadId: uploadIds[0] });
    expect(await screen.findByRole("img", { name: "Photo de la recette" })).toHaveAttribute(
      "src",
      expect.stringContaining("storage.test")
    );
  });

  it("recette existante : la photo change et se retire tout de suite, sans revision", async () => {
    const recipe = buildRecipe({ title: "Gratin" });
    const s = recipeServer({ myRole: "OWNER", recipes: [recipe] });
    mockUploads();
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    await user.upload(await screen.findByLabelText("Ajouter la photo"), photoFile());
    await waitFor(() => {
      expect(s.recipes.calls).toContain(`photo:${recipe.id}`);
    });
    await user.click(await screen.findByRole("button", { name: "Retirer la photo" }));
    await waitFor(() => {
      expect(s.recipes.calls).toContain(`photo-removed:${recipe.id}`);
    });
    expect(s.recipes.bodies.update).toBeUndefined();
  });

  it("un titre vide est signale sans appel a l'API", async () => {
    const s = recipeServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    await screen.findByLabelText("Titre");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Donne un titre à la recette.")).toBeInTheDocument();
    expect(s.recipes.bodies.create).toBeUndefined();
  });

  it("Annuler demande confirmation ; le brouillon est garde et restaure (D104)", async () => {
    const s = recipeServer();
    const first = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    await first.user.type(await screen.findByLabelText("Titre"), "Gratin de Jeanne");
    await first.user.click(screen.getByRole("button", { name: "Annuler" }));
    const sheet = screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
    await first.user.click(within(sheet).getByRole("button", { name: "Continuer l'édition" }));
    expect(screen.getByLabelText("Titre")).toHaveValue("Gratin de Jeanne");
    first.unmount();

    // L'application est fermee sans enregistrer : le brouillon revient.
    const second = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    expect(await screen.findByLabelText("Titre")).toHaveValue("Gratin de Jeanne");
    expect(screen.getByText(/Brouillon restauré/)).toBeInTheDocument();
    await second.user.click(screen.getByRole("button", { name: "Annuler" }));
    await second.user.click(
      within(screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" })).getByRole(
        "button",
        { name: "Quitter" }
      )
    );
    await screen.findByRole("heading", { name: "Pas encore de recette dans Famille" });
    expect(drafts()).toEqual([]);
  });

  it("modifie une recette : la revision suivante est annoncee, conflit signale", async () => {
    const recipe = buildRecipe({ title: "Gratin", currentRevision: 3 });
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    const title = await screen.findByLabelText("Titre");
    expect(title).toHaveValue("Gratin");
    await user.clear(title);
    await user.type(title, "Gratin dauphinois");
    await user.click(screen.getByRole("button", { name: "Enregistrer la révision 4" }));
    expect(await screen.findByRole("heading", { name: "Gratin dauphinois" })).toBeInTheDocument();
    expect(s.recipes.bodies.update).toMatchObject({ revision: 3, title: "Gratin dauphinois" });

    // Une autre personne a enregistre entre-temps.
    await user.click(screen.getByRole("link", { name: "Modifier" }));
    s.recipes.recipes[0] = { ...s.recipes.recipes[0]!, currentRevision: 9 };
    await user.click(await screen.findByRole("button", { name: "Enregistrer la révision 5" }));
    expect(await screen.findByText(/modifiée entre-temps/)).toBeInTheDocument();
  });
});

describe("detail d'une recette (E-RECETTE)", () => {
  it("montre auteur, revision, ingredients et etapes ; les portions mettent a l'echelle", async () => {
    const recipe = buildRecipe({ title: "Gratin", currentRevision: 2 });
    const s = recipeServer({ recipes: [recipe] });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    expect(await screen.findByRole("heading", { name: "Gratin" })).toBeInTheDocument();
    expect(screen.getByText("par lea · révision 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /500 g Pâtes/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /à goût Sel/ })).toBeInTheDocument();
    expect(screen.getByText("Gratiner 20 min.")).toBeInTheDocument();

    const portions = screen.getByRole("group", { name: "Portions" });
    for (let i = 0; i < 4; i += 1) await user.click(within(portions).getByLabelText("Plus"));
    expect(screen.getByRole("checkbox", { name: /1 kg Pâtes/ })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("compteurs du planning (D39) : seulement quand le planning est actif", async () => {
    const planned = buildRecipe({ title: "Dahl", planning: { count: 3, lastOn: "2026-11-02" } });
    const never = buildRecipe({ title: "Curry", planning: { count: 0, lastOn: null } });
    const off = buildRecipe({ title: "Soupe" });
    const s = recipeServer({ recipes: [planned, never, off] });
    const first = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${planned.id}`,
    });
    await screen.findByRole("heading", { name: "Dahl" });
    expect(screen.getByText("Planifiée 3 fois · dernière fois le 2 novembre")).toBeInTheDocument();
    first.unmount();

    const second = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${never.id}` });
    await screen.findByRole("heading", { name: "Curry" });
    expect(screen.getByText("Jamais planifiée")).toBeInTheDocument();
    second.unmount();

    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${off.id}` });
    await screen.findByRole("heading", { name: "Soupe" });
    expect(screen.queryByText(/planifiée/i)).not.toBeInTheDocument();
  });

  it("sans droit de modifier : ni Modifier ni Supprimer, l'historique reste", async () => {
    const recipe = buildRecipe({ can: { edit: false, delete: false } });
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await screen.findByRole("heading", { name: recipe.title });
    expect(screen.queryByRole("link", { name: "Modifier" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plus d'actions" }));
    expect(await screen.findByRole("menuitem", { name: "Voir l'historique" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("supprime apres confirmation et revient a la liste (F-REC-10)", async () => {
    const recipe = buildRecipe({ title: "Gratin" });
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    const sheet = screen.getByRole("dialog", { name: "Supprimer « Gratin » ?" });
    await user.click(within(sheet).getByRole("button", { name: "Supprimer" }));
    await screen.findByRole("heading", { name: "Pas encore de recette dans Famille" });
    expect(s.recipes.calls).toContain(`delete:${recipe.id}`);
  });

  it("recette introuvable", async () => {
    const s = recipeServer();
    renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/00000000-0000-4000-8000-000000000000`,
    });
    expect(await screen.findByRole("heading", { name: "Recette introuvable" })).toBeInTheDocument();
  });
});
