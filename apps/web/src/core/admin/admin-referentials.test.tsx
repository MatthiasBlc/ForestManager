// Admin, C4.3 : ingredients (A05), fusion (A05b), unites (A06), rayons (A07), tags globaux (A08).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { INGREDIENTS, mockReferentialsApi } from "../../test/admin-referentials-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";

const { TARGET, DUPLICATE } = INGREDIENTS;

describe("ingredients (A05)", () => {
  it("navigation : les quatre referentiels", async () => {
    mockReferentialsApi();
    renderWithProviders(<App />, { route: "/admin" });
    const nav = await screen.findByRole("navigation", { name: "Administration" });
    for (const name of ["Ingrédients", "Unités et conversions", "Rayons", "Tags globaux"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("liste les nouveaux avec compteurs et doublon probable, puis verifie un ingredient", async () => {
    const { state } = mockReferentialsApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/ingredients" });
    expect(await screen.findByRole("button", { name: "Nouveaux (2)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Vérifiés (1)" })).toBeInTheDocument();
    const row = await screen.findByRole("button", { name: /tomates cerises/ });
    expect(row).toHaveTextContent("Doublon probable");
    expect(row).toHaveTextContent("par lea, hier · 1 recette");

    await user.click(row);
    const detail = await screen.findByRole("region", { name: "tomates cerises" });
    expect(detail).toHaveTextContent("Doublon probable de « tomate cerise » (vérifié, 7 recettes)");
    expect(await axeViolations(container)).toEqual([]);

    await user.type(within(detail).getByLabelText("Anglais (singulier)"), "cherry tomato");
    await user.selectOptions(within(detail).getByLabelText("Rayon"), "Fruits et légumes");
    await user.type(within(detail).getByLabelText("Poids de 1 pièce (g)"), "15");
    await user.click(within(detail).getByRole("button", { name: "Marquer comme vérifié" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual({
        method: "PUT",
        path: `/admin/ingredients/${DUPLICATE.id}`,
        body: {
          fr: { name: "tomates cerises", namePlural: null },
          en: { name: "cherry tomato", namePlural: null },
          aisleId: TARGET.aisleId,
          defaultUnitId: null,
          unitWeights: [{ unitId: TARGET.defaultUnitId, grams: 15 }],
          verify: true,
        },
      });
    });
    expect(await screen.findByText("« tomates cerises » vérifié")).toBeInTheDocument();
  });

  it("onglet dans l'adresse : sans rayon", async () => {
    mockReferentialsApi();
    renderWithProviders(<App />, { route: "/admin/ingredients?tab=NO_AISLE" });
    expect(await screen.findByRole("button", { name: "Sans rayon (2)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("ajoute un ingredient verifie", async () => {
    const { state } = mockReferentialsApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/ingredients" });
    await user.click(await screen.findByRole("button", { name: "Ajouter un ingrédient" }));
    const sheet = await screen.findByRole("dialog", { name: "Ajouter un ingrédient" });
    await user.type(within(sheet).getByLabelText("Nom en français"), "kecap manis");
    await user.click(within(sheet).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual({
        method: "POST",
        path: "/admin/ingredients",
        body: { fr: { name: "kecap manis" }, en: null },
      });
    });
  });
});

describe("fusion (A05b, D120)", () => {
  it("annonce ce qui disparait et ce qui reste, puis fusionne", async () => {
    const { state } = mockReferentialsApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/ingredients" });
    await user.click(await screen.findByRole("button", { name: /tomates cerises/ }));
    const detail = await screen.findByRole("region", { name: "tomates cerises" });
    await user.click(within(detail).getByRole("button", { name: "Fusionner…" }));
    const sheet = await screen.findByRole("dialog", { name: "Fusionner « tomates cerises »" });
    expect(within(sheet).getByRole("radio", { name: /tomate cerise \(vérifié\)/ })).toBeChecked();
    expect(sheet).toHaveTextContent("1 recette · pas de rayon · pas d'anglais");
    expect(sheet).toHaveTextContent("7 recettes · Fruits et légumes · cherry tomato");
    expect(sheet).toHaveTextContent(
      "La recette « Compotée de tomates cerises » de lea utilisera « tomate cerise ». Les quantités ne changent pas."
    );
    expect(sheet).toHaveTextContent("Personne n'est notifié");
    await user.click(within(sheet).getByRole("button", { name: "Fusionner" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual({
        method: "POST",
        path: `/admin/ingredients/${DUPLICATE.id}/merge`,
        body: { intoId: TARGET.id },
      });
    });
    expect(await screen.findByRole("region", { name: "tomate cerise" })).toBeInTheDocument();
  });
});

describe("unites (A06)", () => {
  it("tableau filtre par dimension et testeur d'addition", async () => {
    mockReferentialsApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/units" });
    const table = await screen.findByRole("table", { name: "Unités" });
    expect(
      within(table).getByRole("row", { name: /tbsp c\. à soupe Volume 15 ml tbsp/ })
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Pièces" }));
    expect(within(table).queryByText("tbsp")).not.toBeInTheDocument();
    expect(within(table).getByText("par ingrédient")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    const tester = screen.getByRole("complementary", { name: "Tester une addition" });
    await user.clear(within(tester).getByLabelText("Première quantité"));
    await user.type(within(tester).getByLabelText("Première quantité"), "3");
    await user.selectOptions(within(tester).getByLabelText("Première unité"), "c. à soupe");
    await user.clear(within(tester).getByLabelText("Seconde quantité"));
    await user.type(within(tester).getByLabelText("Seconde quantité"), "20");
    await user.selectOptions(within(tester).getByLabelText("Seconde unité"), "ml");
    expect(within(tester).getByRole("status")).toHaveTextContent("6,5 cl");
    expect(within(tester).getByRole("status")).toHaveTextContent("3 × 15 ml + 20 ml");

    // Pieces : en grammes seulement avec le poids de l'ingredient, sinon deux lignes.
    await user.selectOptions(within(tester).getByLabelText("Première unité"), "pièce");
    await user.selectOptions(within(tester).getByLabelText("Seconde unité"), "g");
    expect(within(tester).getByRole("status")).toHaveTextContent("20 g et 3 pièces");
    await user.type(within(tester).getByLabelText("Poids de 1 pièce (g)"), "15");
    expect(within(tester).getByRole("status")).toHaveTextContent("65 g");
    expect(within(tester).getByRole("status")).toHaveTextContent("3 × 15 g + 20 g");
  });

  it("modifie une unite", async () => {
    const { state } = mockReferentialsApi();
    const { user } = renderWithProviders(<App />, { route: "/admin/units" });
    await user.click(await screen.findByRole("button", { name: "Modifier c. à soupe" }));
    const sheet = await screen.findByRole("dialog", { name: "Modifier « c. à soupe »" });
    const factor = within(sheet).getByLabelText("Vers la base (ml)");
    await user.clear(factor);
    await user.type(factor, "14,8");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual(
        expect.objectContaining({
          method: "PATCH",
          body: expect.objectContaining({ dimension: "VOLUME", toBase: 14.8 }),
        })
      );
    });
  });
});

describe("rayons (A07)", () => {
  it("ordonne, signale les sans rayon et ajoute un rayon", async () => {
    const { state } = mockReferentialsApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/aisles" });
    const list = await screen.findByRole("list", { name: "Rayons dans l'ordre du magasin" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Fruits et légumes");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Produce · 96 ingrédients");
    expect(screen.getByText(/12 ingrédients sans rayon/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Les classer" })).toHaveAttribute(
      "href",
      "/admin/ingredients?tab=NO_AISLE"
    );
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Descendre Fruits et légumes" }));
    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Boulangerie");
    });
    expect(state.calls).toContainEqual(
      expect.objectContaining({ method: "PUT", path: "/admin/aisles/order" })
    );

    await user.click(screen.getByRole("button", { name: "Ajouter un rayon" }));
    const sheet = await screen.findByRole("dialog", { name: "Ajouter un rayon" });
    await user.type(within(sheet).getByLabelText("Nom en français"), "Vrac");
    await user.click(within(sheet).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual({
        method: "POST",
        path: "/admin/aisles",
        body: { fr: "Vrac", en: null },
      });
    });
  });
});

describe("tags globaux (A08)", () => {
  it("a traduire, renommer, fusionner et supprimer", async () => {
    const { state } = mockReferentialsApi();
    const { user, container } = renderWithProviders(<App />, { route: "/admin/tags" });
    const table = await screen.findByRole("table", { name: "Tags globaux" });
    expect(within(table).getByRole("row", { name: /Apéritif À traduire 14/ })).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Renommer ou traduire Apéritif" }));
    let sheet = await screen.findByRole("dialog", { name: "Modifier « Apéritif »" });
    await user.type(within(sheet).getByLabelText("Nom en anglais"), "Appetizer");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(state.calls).toContainEqual(
        expect.objectContaining({ method: "PATCH", body: { fr: "Apéritif", en: "Appetizer" } })
      );
    });

    await user.click(
      await screen.findByRole("button", { name: "Fusionner Rapide dans un autre tag" })
    );
    sheet = await screen.findByRole("dialog", { name: "Fusionner « Rapide »" });
    await user.selectOptions(within(sheet).getByLabelText("Fusionner dans"), "Végétarien");
    expect(sheet).toHaveTextContent("Ses 61 recettes passeront à « Végétarien »");
    await user.click(within(sheet).getByRole("button", { name: "Fusionner" }));
    await waitFor(() => {
      expect(within(table).queryByText("Rapide")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Renommer ou traduire Végétarien" }));
    sheet = await screen.findByRole("dialog", { name: "Modifier « Végétarien »" });
    await user.click(within(sheet).getByRole("button", { name: "Supprimer le tag" }));
    sheet = await screen.findByRole("dialog", { name: "Supprimer « Végétarien » ?" });
    expect(sheet).toHaveTextContent("Il sera retiré de ses 48 recettes.");
    await user.click(within(sheet).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(within(table).queryByText("Végétarien")).not.toBeInTheDocument();
    });
  });
});
