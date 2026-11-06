// Import d'une recette (C3.8) : F-IMPORT-URL, F-IMPORT-TEXTE, puis l'editeur
// pre-rempli ; l'enregistrement part avec `imported` (revision IMPORT).
import { errorBody, type ImportedRecipe } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { unitId } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";

beforeEach(() => {
  localStorage.clear();
});

const CURRY: ImportedRecipe = {
  title: "Curry d'aubergine",
  yieldQuantity: 2,
  prepMinutes: 15,
  cookMinutes: 25,
  restMinutes: null,
  sourceUrl: "https://exemple.fr/curry",
  ingredients: [
    {
      raw: "2 c. à soupe d'huile",
      quantity: 2,
      unitCode: "tbsp",
      name: "huile",
      note: null,
      check: false,
    },
    {
      raw: "1 oignon, émincé",
      quantity: 1,
      unitCode: null,
      name: "oignon",
      note: "émincé",
      check: false,
    },
    { raw: "Persil", quantity: null, unitCode: null, name: "Persil", note: null, check: true },
  ],
  steps: ["Couper l'aubergine.", "Cuire 25 min."],
};

async function openAddSheet(spaceId: string) {
  const rendered = renderWithProviders(<App />, { route: `/s/${spaceId}/recipes` });
  await rendered.user.click(
    (await screen.findAllByRole("button", { name: "Nouvelle recette" }))[0]!
  );
  return {
    ...rendered,
    sheet: screen.getByRole("dialog", { name: "Nouvelle recette dans Famille" }),
  };
}

describe("importer un lien (F-IMPORT-URL)", () => {
  it("ouvre l'editeur pre-rempli, puis enregistre une recette importee", async () => {
    const s = recipeServer();
    const sent: unknown[] = [];
    server.use(
      http.post(`/api/v1/spaces/${s.space.id}/recipes/import`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(CURRY);
      })
    );
    const { user, sheet } = await openAddSheet(s.space.id);
    await user.click(within(sheet).getByRole("button", { name: /Importer un lien/ }));
    const dialog = await screen.findByRole("dialog", { name: "Importer depuis un lien" });
    await user.type(
      within(dialog).getByLabelText("Lien de la recette"),
      "https://exemple.fr/curry"
    );
    await user.click(within(dialog).getByRole("button", { name: "Importer" }));

    expect(await screen.findByLabelText("Titre")).toHaveValue("Curry d'aubergine");
    expect(sent).toEqual([{ url: "https://exemple.fr/curry" }]);
    const banner = screen
      .getAllByRole("status")
      .find((node) => node.textContent.includes("Recette importée"));
    expect(banner).toHaveTextContent("1 quantité à vérifier");
    expect(screen.getByLabelText("Source (lien)")).toHaveValue("https://exemple.fr/curry");
    expect(screen.getByLabelText("Étape 2")).toHaveValue("Cuire 25 min.");

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Curry d'aubergine" })).toBeInTheDocument();
    const body = s.recipes.bodies.create as Record<string, unknown> & {
      blocks: { ingredients: unknown[] }[];
    };
    expect(body).toMatchObject({
      imported: true,
      yieldQuantity: 2,
      prepMinutes: 15,
      cookMinutes: 25,
      sourceUrl: "https://exemple.fr/curry",
      blocks: [{ steps: ["Couper l'aubergine.", "Cuire 25 min."] }],
    });
    expect(body.blocks[0]?.ingredients).toMatchObject([
      { quantity: 2, unitId: unitId("tbsp") },
      { quantity: 1, unitId: null, note: "émincé" },
      { quantity: null, unitId: null },
    ]);
  });

  it("explique un echec et propose de coller le texte", async () => {
    const s = recipeServer();
    server.use(
      http.post(`/api/v1/spaces/${s.space.id}/recipes/import`, () =>
        HttpResponse.json(errorBody("RECIPE_017"), { status: 422 })
      )
    );
    const { user, sheet } = await openAddSheet(s.space.id);
    await user.click(within(sheet).getByRole("button", { name: /Importer un lien/ }));
    const dialog = await screen.findByRole("dialog", { name: "Importer depuis un lien" });
    await user.type(within(dialog).getByLabelText("Lien de la recette"), "https://exemple.fr/x");
    await user.click(within(dialog).getByRole("button", { name: "Importer" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Aucune recette trouvée sur cette page."
    );
    await user.click(within(dialog).getByRole("button", { name: "Coller le texte" }));
    expect(await screen.findByRole("dialog", { name: "Coller un texte" })).toBeInTheDocument();
  });
});

describe("coller un texte (F-IMPORT-TEXTE)", () => {
  it("resume ce qui est repere puis ouvre l'editeur", async () => {
    const s = recipeServer();
    const { user, sheet } = await openAddSheet(s.space.id);
    await user.click(within(sheet).getByRole("button", { name: /Coller un texte/ }));
    const dialog = await screen.findByRole("dialog", { name: "Coller un texte" });
    const open = within(dialog).getByRole("button", { name: "Ouvrir dans l'éditeur" });
    expect(open).toBeDisabled();

    await user.click(within(dialog).getByLabelText("Texte de la recette"));
    await user.paste(
      "Vinaigrette\nPour 4 personnes\nIngrédients\n3 c. à soupe d'huile\n1 c. à soupe de vinaigre\nsel\nPréparation\n1. Tout mélanger.\n2. Servir."
    );
    const summary = within(dialog).getByRole("status");
    expect(summary).toHaveTextContent("Titre repéré");
    expect(summary).toHaveTextContent("3 ingrédients");
    expect(summary).toHaveTextContent("2 étapes");
    expect(summary).toHaveTextContent("1 quantité à vérifier");

    await user.click(open);
    expect(await screen.findByLabelText("Titre")).toHaveValue("Vinaigrette");
    expect(screen.getByLabelText("Étape 1")).toHaveValue("Tout mélanger.");
    await waitFor(() => {
      expect(
        screen.getAllByRole("group", { name: /^Ingrédient \d$/ }).length
      ).toBeGreaterThanOrEqual(3);
    });
  });
});
