// Ecrans des recettes simples (C3.2) : liste, ajout, detail, edition, suppression.
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, unitId, uuid } from "../../test/fixtures.ts";
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
    // R8 : rien a chercher ni a filtrer.
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtres" })).not.toBeInTheDocument();
  });

  it("recherche, puis feuille de filtres : tags par famille, Bases, filtres actifs retirables (D216)", async () => {
    const s = recipeServer({
      recipes: [buildRecipe({ title: "Gratin de pâtes" }), buildRecipe({ title: "Dahl" })],
    });
    const [veggie, quick] = s.recipes.globalTags;
    const saison = { id: uuid(), scope: "GLOBAL" as const, name: "Régime" };
    s.recipes.tagFamilies.push(saison);
    s.recipes.familyOf[veggie!.id] = saison.id;
    s.recipes.recipes[1]!.tags = [veggie!, quick!];
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    // Cartes : les deux premiers tags, famille d'abord.
    const dahl = await screen.findByRole("article", { name: "Dahl" });
    expect(within(dahl).getByText("Végétarien · Rapide")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Rechercher une recette" }), "gratin");
    await waitFor(() => {
      expect(screen.queryByRole("article", { name: "Dahl" })).not.toBeInTheDocument();
    });
    expect(s.recipes.queries.at(-1)?.get("q")).toBe("gratin");
    await user.clear(screen.getByRole("searchbox", { name: "Rechercher une recette" }));

    await user.click(screen.getByRole("button", { name: "Filtres" }));
    const sheet = screen.getByRole("dialog", { name: "Filtres" });
    // Tag sans recette masque ; famille "Régime" puis "Autres".
    expect(
      within(sheet).queryByRole("button", { name: /Plat du dimanche/ })
    ).not.toBeInTheDocument();
    await user.click(
      within(within(sheet).getByRole("group", { name: "Régime" })).getByRole("button", {
        name: "Végétarien, 1 recette",
      })
    );
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("tagIds")).toBe(veggie!.id);
    });
    await user.click(within(sheet).getByRole("switch", { name: /Bases seulement/ }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("base")).toBe("true");
    });
    await user.click(within(sheet).getByRole("button", { name: "Voir 0 recette" }));
    expect(screen.queryByRole("dialog", { name: "Filtres" })).not.toBeInTheDocument();

    // Filtres actifs sous la recherche, retirables un par un ; le bouton compte les filtres.
    const active = screen.getByRole("group", { name: "Filtres actifs" });
    expect(screen.getByRole("button", { name: "Filtres (2)" })).toBeInTheDocument();
    await user.click(within(active).getByRole("button", { name: "Bases, retirer le filtre" }));
    expect(await screen.findByRole("article", { name: "Dahl" })).toBeInTheDocument();
    await user.click(within(active).getByRole("button", { name: "Végétarien, retirer le filtre" }));
    expect(await screen.findByRole("article", { name: "Gratin de pâtes" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtres actifs" })).not.toBeInTheDocument();
  });

  it("feuille de filtres : Trier par, A a Z par defaut, choix retenu sur l'appareil (D217)", async () => {
    const s = recipeServer({ recipes: [buildRecipe({ title: "Dahl" })] });
    const first = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("article", { name: "Dahl" });
    expect(s.recipes.queries.at(-1)?.get("sort")).toBeNull();

    await first.user.click(screen.getByRole("button", { name: "Filtres" }));
    const sheet = screen.getByRole("dialog", { name: "Filtres" });
    const sorts = within(sheet).getByRole("group", { name: "Trier par" });
    expect(within(sorts).getByRole("button", { name: "A à Z" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await first.user.click(within(sorts).getByRole("button", { name: "Plus récentes" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("sort")).toBe("recent");
    });
    expect(within(sorts).getByRole("button", { name: "A à Z" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await first.user.click(within(sheet).getByRole("button", { name: /^Voir/ }));
    expect(screen.getByRole("group", { name: "Filtres actifs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtres (1)" })).toBeInTheDocument();
    first.unmount();

    // Retenu : on revient avec le meme ordre, retirable comme un filtre.
    const again = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("article", { name: "Dahl" });
    expect(s.recipes.queries.at(-1)?.get("sort")).toBe("recent");
    await again.user.click(
      within(screen.getByRole("group", { name: "Filtres actifs" })).getByRole("button", {
        name: "Tri : Plus récentes, retirer le filtre",
      })
    );
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("sort")).toBeNull();
    });
    expect(screen.queryByRole("group", { name: "Filtres actifs" })).not.toBeInTheDocument();
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

  it("une ligne : + Precision ouvre la precision, la case Facultatif regle le flag (D232)", async () => {
    const s = recipeServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/new` });
    await user.type(await screen.findByLabelText("Titre"), "Risotto");
    const line = screen.getAllByRole("group", { name: "Ingrédient 1" })[0]!;
    // Ligne vide : rien de plus a regler.
    expect(within(line).queryByRole("button", { name: "Précision" })).not.toBeInTheDocument();
    expect(within(line).queryByRole("checkbox", { name: "Facultatif" })).not.toBeInTheDocument();

    await user.type(within(line).getByRole("combobox", { name: "Ingrédient" }), "pât");
    await user.click(await screen.findByRole("option", { name: "Pâtes" }));
    expect(within(line).queryByLabelText("Précision")).not.toBeInTheDocument();
    await user.click(within(line).getByRole("button", { name: "Précision" }));
    const note = within(line).getByLabelText("Précision");
    expect(note).toHaveFocus();
    await user.type(note, "ou riz");
    expect(within(line).queryByRole("button", { name: "Précision" })).not.toBeInTheDocument();
    await user.click(within(line).getByRole("checkbox", { name: "Facultatif" }));

    await user.type(screen.getByLabelText("Étape 1"), "Cuire.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Risotto" })).toBeInTheDocument();
    expect(s.recipes.bodies.create).toMatchObject({
      blocks: [{ ingredients: [{ note: "ou riz", optional: true }] }],
    });
  });

  it("une ligne existante : precision et facultatif se relisent et se retirent", async () => {
    const recipe = buildRecipe();
    const block = recipe.blocks[0] as Extract<(typeof recipe.blocks)[number], { kind: "LOCAL" }>;
    block.ingredients[0] = { ...block.ingredients[0]!, note: "fraîches", optional: true };
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    const line = (await screen.findAllByRole("group", { name: "Ingrédient 1" }))[0]!;
    expect(within(line).getByLabelText("Précision")).toHaveValue("fraîches");
    const optional = within(line).getByRole("checkbox", { name: "Facultatif" });
    expect(optional).toBeChecked();
    await user.click(optional);
    await user.clear(within(line).getByLabelText("Précision"));
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => {
      expect(s.recipes.bodies.update).toMatchObject({
        blocks: [{ ingredients: [{ note: null, optional: false }, {}] }],
      });
    });
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
    // D3 : l'erreur tombe des que le titre est saisi.
    await user.type(screen.getByLabelText("Titre"), "Gratin");
    expect(screen.queryByText("Donne un titre à la recette.")).not.toBeInTheDocument();
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

  it("une section Tags : choisis retirables, Ajouter des tags, creer un tag d'espace (D216)", async () => {
    const s = recipeServer();
    const [veggie] = s.recipes.globalTags;
    const sunday = s.recipes.spaceTags[0]!;
    const recipe = buildRecipe({ title: "Gratin", tags: [veggie!, sunday] });
    s.recipes.recipes.push({ ...recipe, homeSpaceId: s.space.id });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    const section = await screen.findByRole("group", { name: "Tags" });
    expect(
      await within(section).findByText(/Plat du dimanche est un tag de Famille/)
    ).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Végétarien, retirer le tag" }));
    await user.click(within(section).getByRole("button", { name: "Ajouter des tags" }));
    const sheet = screen.getByRole("dialog", { name: "Tags de la recette" });
    await user.click(within(sheet).getByRole("button", { name: "Rapide" }));
    await user.type(within(sheet).getByRole("searchbox", { name: "Chercher un tag" }), "Raclette");
    await user.click(
      within(sheet).getByRole("button", { name: /^Créer le tag « Raclette » dans Famille/ })
    );
    expect(await within(sheet).findByRole("button", { name: "Raclette" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer la révision 2" }));
    await screen.findByRole("heading", { name: "Gratin", level: 1 });
    const raclette = s.recipes.spaceTags.find((tag) => tag.name === "Raclette")!;
    expect(s.recipes.bodies.update).toMatchObject({
      globalTagIds: [s.recipes.globalTags[1]!.id],
      spaceTagIds: [sunday.id, raclette.id],
    });
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

  it("une ligne facultative : precision puis facultatif apres le nom (D232)", async () => {
    const recipe = buildRecipe();
    const block = recipe.blocks[0] as Extract<(typeof recipe.blocks)[number], { kind: "LOCAL" }>;
    block.ingredients[0] = { ...block.ingredients[0]!, note: "fraîches", optional: true };
    const s = recipeServer({ recipes: [recipe] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}` });
    const row = await screen.findByRole("checkbox", { name: "500 g Pâtes fraîches facultatif" });
    expect(row).toHaveTextContent("Pâtes, fraîches · facultatif");
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

  it("modifier sans en avoir le droit : explique et propose une suggestion (D15)", async () => {
    const recipe = buildRecipe({ title: "Gratin", can: { edit: false, delete: false } });
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/edit`,
    });
    expect(
      await screen.findByRole("heading", { name: "Modification réservée" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/supprimée/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Proposer une modification" }));
    expect(await screen.findByText(/Mode suggestion/)).toBeInTheDocument();
  });
});
