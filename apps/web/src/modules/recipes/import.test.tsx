// Import d'une recette (C3.8) : F-IMPORT-URL, F-IMPORT-TEXTE, puis l'editeur
// pre-rempli ; l'enregistrement part avec `imported` (revision IMPORT).
import { errorBody, type ImportedRecipe } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { unitId } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockUploads } from "../../test/uploads.ts";

vi.mock("../../lib/image.ts", () => import("../../test/fake-image.ts"));

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
  imageUrl: null,
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
    (await screen.findAllByRole("button", { name: "Ajouter une recette" }))[0]!
  );
  const root = screen.getByRole("dialog", { name: "Ajouter une recette dans Famille" });
  await rendered.user.click(within(root).getByRole("button", { name: /Créer/ }));
  return {
    ...rendered,
    sheet: screen.getByRole("dialog", { name: "Créer une recette" }),
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
    await user.click(within(sheet).getByRole("button", { name: /Un lien/ }));
    const dialog = await screen.findByRole("dialog", { name: "Importer depuis un lien" });
    await user.click(within(dialog).getByLabelText("Lien de la recette"));
    await user.paste("https://exemple.fr/curry");
    await user.click(within(dialog).getByRole("button", { name: "Importer" }));

    expect(await screen.findByLabelText("Titre")).toHaveValue("Curry d'aubergine");
    expect(sent).toEqual([{ url: "https://exemple.fr/curry" }]);
    const banner = screen
      .getAllByRole("status")
      .find((node) => node.textContent.includes("Recette importée"));
    expect(banner).toHaveTextContent("1 quantité à vérifier");
    expect(screen.getByLabelText("Source (lien)")).toHaveValue("https://exemple.fr/curry");
    expect(screen.getByLabelText("Étape 2")).toHaveValue("Cuire 25 min.");

    // D2 : la ligne douteuse porte son badge, qui tombe des qu'on la touche (D103).
    const persil = screen.getByRole("group", { name: "Ingrédient 3" });
    expect(within(persil).getByText("À vérifier")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Ingrédient 1" })).queryByText("À vérifier")
    ).not.toBeInTheDocument();
    // D4 : la precision importee se lit et se modifie.
    const oignon = screen.getByRole("group", { name: "Ingrédient 2" });
    const note = within(oignon).getByLabelText("Précision");
    expect(note).toHaveValue("émincé");
    await user.clear(note);
    await user.type(note, "haché");
    await user.type(within(persil).getByLabelText("Quantité"), "1");
    expect(within(persil).queryByText("À vérifier")).not.toBeInTheDocument();

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
      { quantity: 1, unitId: null, note: "haché" },
      { quantity: 1, unitId: null },
    ]);
  });

  it("reprend la photo de la page, rattachee a l'enregistrement (D13)", async () => {
    const s = recipeServer();
    const { uploadIds } = mockUploads();
    const asked: unknown[] = [];
    server.use(
      http.post(`/api/v1/spaces/${s.space.id}/recipes/import`, () =>
        HttpResponse.json({ ...CURRY, imageUrl: "https://exemple.fr/curry.jpg" })
      ),
      http.post(`/api/v1/spaces/${s.space.id}/recipes/import/image`, async ({ request }) => {
        asked.push(await request.json());
        return new HttpResponse(new Uint8Array([0xff, 0xd8, 0xff]), {
          headers: { "content-type": "image/jpeg" },
        });
      })
    );
    const { user, sheet } = await openAddSheet(s.space.id);
    await user.click(within(sheet).getByRole("button", { name: /Un lien/ }));
    const dialog = await screen.findByRole("dialog", { name: "Importer depuis un lien" });
    await user.click(within(dialog).getByLabelText("Lien de la recette"));
    await user.paste("https://exemple.fr/curry");
    await user.click(within(dialog).getByRole("button", { name: "Importer" }));

    expect(await screen.findByRole("img", { name: "Photo de la recette" })).toBeInTheDocument();
    expect(asked).toEqual([{ url: "https://exemple.fr/curry.jpg" }]);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: "Curry d'aubergine" })).toBeInTheDocument();
    expect(s.recipes.bodies.photo).toEqual({ uploadId: uploadIds[0] });
  });

  it("explique un echec et propose de coller le texte", async () => {
    const s = recipeServer();
    server.use(
      http.post(`/api/v1/spaces/${s.space.id}/recipes/import`, () =>
        HttpResponse.json(errorBody("RECIPE_017"), { status: 422 })
      )
    );
    const { user, sheet } = await openAddSheet(s.space.id);
    await user.click(within(sheet).getByRole("button", { name: /Un lien/ }));
    const dialog = await screen.findByRole("dialog", { name: "Importer depuis un lien" });
    await user.click(within(dialog).getByLabelText("Lien de la recette"));
    await user.paste("https://exemple.fr/x");
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
    await user.click(within(sheet).getByRole("button", { name: /Un texte collé/ }));
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
