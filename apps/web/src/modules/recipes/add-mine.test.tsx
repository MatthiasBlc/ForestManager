// "Ajouter une recette" dans un espace de groupe (C7c.1) : "Depuis mes recettes"
// d'abord, puis "Creer" (Saisir, un lien, un texte colle) ; selection multiple,
// sous-recettes annoncees, ajout en lot tout ou rien [D203, D208].
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { RECIPE_ACTIVITY } from "./notifications.ts";

type Server = ReturnType<typeof recipeServer>;

/** Mes recettes nees dans l'espace perso, pas encore dans Famille. */
function mine(s: Server, titles: string[]) {
  const self = { id: s.me.id, username: s.me.username, avatarUrl: null };
  s.recipes.addable = titles.map((title) =>
    buildRecipe({
      title,
      author: self,
      homeSpaceId: s.personal.id,
      homeSpace: { id: s.personal.id, name: s.personal.name },
    })
  );
  return s.recipes.addable;
}

async function openAdd(s: Server) {
  const rendered = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
  await rendered.user.click(
    (await screen.findAllByRole("button", { name: "Ajouter une recette" }))[0]!
  );
  return {
    ...rendered,
    sheet: screen.getByRole("dialog", { name: "Ajouter une recette dans Famille" }),
  };
}

async function openMine(s: Server) {
  const rendered = await openAdd(s);
  await rendered.user.click(
    within(rendered.sheet).getByRole("button", { name: /Depuis mes recettes/ })
  );
  return {
    ...rendered,
    picker: await screen.findByRole("dialog", { name: "Mes recettes à ajouter" }),
  };
}

describe("feuille Ajouter une recette (F-AJOUT-RECETTE, D208)", () => {
  it("propose Depuis mes recettes en premier, puis Creer qui ouvre Saisir, un lien, un texte", async () => {
    const s = recipeServer();
    const { user, sheet, container } = await openAdd(s);
    const labels = within(sheet)
      .getAllByRole("button")
      .map((b) => b.textContent);
    const first = labels.findIndex((l) => l.includes("Depuis mes recettes"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(labels.findIndex((l) => l.startsWith("Créer")));

    await user.click(within(sheet).getByRole("button", { name: /Créer/ }));
    const create = screen.getByRole("dialog", { name: "Créer une recette" });
    expect(within(create).getByRole("link", { name: /Saisir/ })).toBeInTheDocument();
    expect(within(create).getByRole("button", { name: /Un lien/ })).toBeInTheDocument();
    expect(within(create).getByRole("button", { name: /Un texte collé/ })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(create).getByRole("button", { name: "Retour" }));
    expect(
      screen.getByRole("dialog", { name: "Ajouter une recette dans Famille" })
    ).toBeInTheDocument();
  });

  it("dans l'espace perso : Nouvelle recette, sans Depuis mes recettes", async () => {
    const s = recipeServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.personal.id}/recipes` });
    await user.click((await screen.findAllByRole("button", { name: "Nouvelle recette" }))[0]!);
    const sheet = screen.getByRole("dialog", { name: "Créer une recette" });
    expect(within(sheet).getByRole("link", { name: /Saisir/ })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Depuis mes recettes/ })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Retour" })).toBeNull();
  });
});

describe("Depuis mes recettes (F-MES-RECETTES, D203)", () => {
  it("coche des recettes et les ajoute d'un coup ; toast et liste a jour", async () => {
    const s = recipeServer({ recipes: [buildRecipe({ title: "Curry de pois chiches" })] });
    const [saumon, , dahl] = mine(s, ["Saumon teriyaki", "Granola", "Dahl"]);
    const { user, picker, container } = await openMine(s);

    expect(
      await within(picker).findByRole("checkbox", { name: /Saumon teriyaki/ })
    ).toBeInTheDocument();
    const add = within(picker).getByRole("button", { name: "Choisis au moins une recette" });
    expect(add).toBeDisabled();
    await user.click(within(picker).getByRole("checkbox", { name: /Saumon teriyaki/ }));
    await user.click(within(picker).getByRole("checkbox", { name: /Dahl/ }));
    expect(within(picker).getByText("2 choisies")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(picker).getByRole("button", { name: "Ajouter 2 recettes" }));
    expect(await screen.findByText("2 recettes ajoutées à Famille")).toBeInTheDocument();
    expect(s.recipes.bodies.addMine).toEqual({ recipeIds: [saumon!.id, dahl!.id] });
    expect(screen.queryByRole("dialog", { name: "Mes recettes à ajouter" })).toBeNull();
    expect(await screen.findByRole("article", { name: "Saumon teriyaki" })).toBeInTheDocument();
  });

  it("annonce les sous-recettes qui suivent avant d'ajouter", async () => {
    const s = recipeServer();
    const [lasagnes] = mine(s, ["Lasagnes"]);
    s.recipes.addMinePreview = [
      { id: crypto.randomUUID(), title: "Béchamel", included: true },
      { id: crypto.randomUUID(), title: "Pâte fraîche", included: false },
    ];
    const { user, picker } = await openMine(s);
    await user.click(await within(picker).findByRole("checkbox", { name: /Lasagnes/ }));
    await user.click(within(picker).getByRole("button", { name: "Ajouter 1 recette" }));

    const confirm = await screen.findByRole("dialog", { name: "Ajouter 1 recette à Famille" });
    expect(s.recipes.bodies.addMinePreview).toEqual({ recipeIds: [lasagnes!.id] });
    expect(s.recipes.bodies.addMine).toBeUndefined();
    const arriving = within(confirm).getByRole("list", { name: "Arrivent avec" });
    expect(within(arriving).getByText("Béchamel")).toBeInTheDocument();
    const staying = within(confirm).getByRole("list", { name: "Restent dans leur espace" });
    expect(within(staying).getByText("Pâte fraîche")).toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText("Lasagnes ajoutée à Famille")).toBeInTheDocument();
    expect(s.recipes.bodies.addMine).toEqual({ recipeIds: [lasagnes!.id] });
  });

  it("recherche transmise a l'API", async () => {
    const s = recipeServer();
    mine(s, ["Saumon teriyaki", "Dahl"]);
    const { user, picker } = await openMine(s);
    await within(picker).findByRole("checkbox", { name: /Dahl/ });
    await user.type(within(picker).getByRole("searchbox", { name: "Rechercher" }), "dah");
    await waitFor(() => {
      expect(within(picker).queryByRole("checkbox", { name: /Saumon/ })).toBeNull();
    });
    const last = s.recipes.queries.at(-1);
    expect(last?.get("addable")).toBe("true");
    expect(last?.get("q")).toBe("dah");
  });

  it("refus (une recette n'est plus disponible) : message, liste rechargee, selection gardee", async () => {
    const s = recipeServer();
    const [saumon, dahl] = mine(s, ["Saumon teriyaki", "Dahl"]);
    s.recipes.addMineFails = true;
    const { user, picker } = await openMine(s);
    await user.click(await within(picker).findByRole("checkbox", { name: /Saumon teriyaki/ }));
    await user.click(within(picker).getByRole("checkbox", { name: /Dahl/ }));
    // Entre-temps, Dahl a ete supprimee.
    s.recipes.addable = s.recipes.addable.filter((r) => r.id !== dahl!.id);

    await user.click(within(picker).getByRole("button", { name: "Ajouter 2 recettes" }));
    expect(
      await within(picker).findByText(
        "Une recette n'est plus disponible : la liste est à jour, vérifie ta sélection."
      )
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(within(picker).queryByRole("checkbox", { name: /Dahl/ })).toBeNull();
    });
    expect(within(picker).getByRole("checkbox", { name: /Saumon teriyaki/ })).toBeChecked();
    expect(within(picker).getByText("1 choisie")).toBeInTheDocument();
    s.recipes.addMineFails = false;
    await user.click(within(picker).getByRole("button", { name: "Ajouter 1 recette" }));
    expect(await screen.findByText("Saumon teriyaki ajoutée à Famille")).toBeInTheDocument();
    expect(s.recipes.bodies.addMine).toEqual({ recipeIds: [saumon!.id] });
  });

  it("50 au plus : les autres cases se grisent", async () => {
    const s = recipeServer();
    mine(
      s,
      Array.from({ length: 51 }, (_, i) => `Recette ${String(i + 1).padStart(2, "0")}`)
    );
    const { user, picker } = await openMine(s);
    const boxes = await within(picker).findAllByRole("checkbox");
    for (const box of boxes.slice(0, 50)) await user.click(box);
    expect(within(picker).getByText("50 choisies")).toBeInTheDocument();
    expect(boxes[50]).toBeDisabled();
    expect(within(picker).getByText("50 max")).toBeInTheDocument();
  });

  it("rien a ajouter : le dit et propose de creer", async () => {
    const s = recipeServer();
    s.add({ title: "Tarte" });
    const { user, picker } = await openMine(s);
    expect(
      await within(picker).findByRole("heading", {
        name: "Toutes tes recettes sont déjà dans Famille",
      })
    ).toBeInTheDocument();
    await user.click(within(picker).getByRole("button", { name: "Créer" }));
    expect(screen.getByRole("dialog", { name: "Créer une recette" })).toBeInTheDocument();
  });

  it("aucune recette du tout : le dit autrement", async () => {
    const s = recipeServer();
    const { picker } = await openMine(s);
    expect(
      await within(picker).findByRole("heading", { name: "Tu n'as pas encore de recette" })
    ).toBeInTheDocument();
  });

  it("s'ouvre depuis la recherche globale (action Ajouter mes recettes)", async () => {
    const s = recipeServer();
    mine(s, ["Dahl"]);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await screen.findByRole("heading", { name: /Pas encore de recette/ });
    await user.keyboard("{Control>}k{/Control}");
    const palette = await screen.findByRole("dialog", { name: "Recherche" });
    await user.click(within(palette).getByRole("option", { name: "Ajouter mes recettes" }));
    const picker = await screen.findByRole("dialog", { name: "Mes recettes à ajouter" });
    expect(await within(picker).findByRole("checkbox", { name: /Dahl/ })).toBeInTheDocument();
  });

  it("le fil d'activite resume un ajout en lot en une ligne", () => {
    const render = RECIPE_ACTIVITY["recipes.recipes.added"]!;
    const event = {
      data: { count: 5, titles: ["Saumon teriyaki", "Dahl", "Gratin"] },
      targetId: null,
    } as unknown as Parameters<typeof render>[0];
    expect(render(event, "s1")).toEqual({
      text: "a ajouté 5 recettes : « Saumon teriyaki », « Dahl », « Gratin »…",
      to: "/s/s1/recipes",
    });
    const three = { ...event, data: { count: 2, titles: ["Dahl", "Gratin"] } };
    expect(render(three as typeof event, "s1").text).toBe(
      "a ajouté 2 recettes : « Dahl », « Gratin »."
    );
  });
});
