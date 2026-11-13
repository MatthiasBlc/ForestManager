// Planning (C5.3) : E-IDEES, ajout et modification d'une idee, suppression,
// "Transformer en recette" vers l'editeur pre-rempli, idee retiree a
// l'enregistrement [F-MPL-4, D182].
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildIdea, mealPlanServer } from "../../test/meal-plan-server.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  localStorage.clear();
});

const RACLETTE = buildIdea({
  name: "Raclette",
  comment: "Un dimanche soir en hiver",
  author: { id: "00000000-0000-4000-8000-000000000001", username: "lea" },
});

function openIdeas(s: ReturnType<typeof mealPlanServer>) {
  return renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan/ideas` });
}

describe("E-IDEES", () => {
  it("s'ouvre depuis le planning et liste les idees avec leur auteur", async () => {
    const s = mealPlanServer({ ideas: [RACLETTE] });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan`,
    });
    await user.click(await screen.findByRole("link", { name: "Idées de repas" }));
    expect(await screen.findByRole("heading", { name: "Raclette" })).toBeInTheDocument();
    const card = screen.getByRole("article", { name: "Raclette" });
    expect(card).toHaveTextContent("Un dimanche soir en hiver");
    expect(card).toHaveTextContent("lea");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("sans idee : etat vide qui invite a en ajouter une", async () => {
    const s = mealPlanServer();
    openIdeas(s);
    expect(await screen.findByText("Aucune idée pour l'instant")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nouvelle idée" }).length).toBeGreaterThan(0);
  });

  it("ajoute une idee avec un commentaire", async () => {
    const s = mealPlanServer();
    const { user } = openIdeas(s);
    await user.click((await screen.findAllByRole("button", { name: "Nouvelle idée" }))[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Nouvelle idée" });
    await user.type(within(sheet).getByLabelText("Nom"), "Curry de pois chiches");
    await user.type(within(sheet).getByLabelText("Commentaire (facultatif)"), "Pas trop épicé");
    await user.click(within(sheet).getByRole("button", { name: "Ajouter" }));
    expect(
      await screen.findByRole("heading", { name: "Curry de pois chiches" })
    ).toBeInTheDocument();
    expect(s.plan.ideaBodies).toEqual([
      { name: "Curry de pois chiches", comment: "Pas trop épicé" },
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("refuse un nom vide", async () => {
    const s = mealPlanServer();
    const { user } = openIdeas(s);
    await user.click((await screen.findAllByRole("button", { name: "Nouvelle idée" }))[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Nouvelle idée" });
    await user.click(within(sheet).getByRole("button", { name: "Ajouter" }));
    expect(within(sheet).getByText("Donne un nom à l'idée.")).toBeInTheDocument();
    expect(s.plan.ideaBodies).toEqual([]);
  });

  it("modifie puis supprime une idee depuis ses actions", async () => {
    const s = mealPlanServer({ ideas: [RACLETTE] });
    const { user } = openIdeas(s);
    await user.click(await screen.findByRole("button", { name: "Actions de l'idée Raclette" }));
    await user.click(await screen.findByRole("menuitem", { name: "Modifier" }));
    const sheet = await screen.findByRole("dialog", { name: "Modifier l'idée" });
    const name = within(sheet).getByLabelText("Nom");
    expect(name).toHaveValue("Raclette");
    await user.clear(name);
    await user.type(name, "Raclette savoyarde");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Raclette savoyarde" })).toBeInTheDocument();
    expect(s.plan.ideaBodies).toEqual([
      { name: "Raclette savoyarde", comment: "Un dimanche soir en hiver" },
    ]);

    await user.click(screen.getByRole("button", { name: "Actions de l'idée Raclette savoyarde" }));
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Raclette savoyarde" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Idée supprimée")).toBeInTheDocument();
  });

  it("sans droit sur l'idee : pas d'actions, mais la transformer reste possible", async () => {
    const s = mealPlanServer({ ideas: [{ ...RACLETTE, can: { edit: false, delete: false } }] });
    openIdeas(s);
    await screen.findByRole("heading", { name: "Raclette" });
    expect(
      screen.queryByRole("button", { name: "Actions de l'idée Raclette" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transformer en recette" })).toBeInTheDocument();
  });

  it("sans le module Recettes actif : pas de transformation", async () => {
    const s = mealPlanServer({ ideas: [RACLETTE] });
    s.space.modules = [{ code: "meal-plan", sortOrder: 0 }];
    openIdeas(s);
    await screen.findByRole("heading", { name: "Raclette" });
    expect(
      screen.queryByRole("button", { name: "Transformer en recette" })
    ).not.toBeInTheDocument();
  });
});

describe("Transformer en recette (F-MPL-4, D182)", () => {
  it("ouvre l'editeur pre-rempli, enregistre la recette puis retire l'idee", async () => {
    const s = mealPlanServer({ ideas: [RACLETTE] });
    const r = recipeServer({ on: s });
    const { user } = openIdeas(s);
    await user.click(await screen.findByRole("button", { name: "Transformer en recette" }));

    expect(await screen.findByLabelText("Titre")).toHaveValue("Raclette");
    expect(screen.getByLabelText("Notes")).toHaveValue("Un dimanche soir en hiver");
    const banner = screen
      .getAllByRole("status")
      .find((node) => node.textContent.includes("idée de repas"));
    expect(banner).toHaveTextContent(
      "Créée depuis l'idée de repas de lea dans le planning de Famille"
    );

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Raclette" })).toBeInTheDocument();
    const created = r.recipes.recipes.find((recipe) => recipe.title === "Raclette");
    await waitFor(() => {
      expect(s.plan.conversions).toEqual([{ ideaId: RACLETTE.id, recipeId: created?.id }]);
    });
    expect(r.recipes.bodies.create).not.toHaveProperty("imported");
  });
});
