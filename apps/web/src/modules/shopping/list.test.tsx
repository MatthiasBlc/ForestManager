// Liste de courses (C9 etape 4a) : navigation, liste par section, cocher, ajouter,
// detail d'un article (sources, section, quantite, ordre, retirer) [D228, D231].
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { NOW, unitId } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import {
  buildIngredient,
  buildItem,
  buildSection,
  shoppingServer,
} from "../../test/shopping-server.ts";

const primeur = buildSection("Primeur");
const alimentaire = buildSection("Alimentaire");
const boucher = buildSection("Boucher");

const source = (recipeTitle: string, quantity: number, unit = "g") => ({
  mealSlotId: null,
  recipeId: null,
  recipeTitle,
  date: "2026-11-18",
  mealTime: "DINNER" as const,
  parts: [{ quantity, unitId: unitId(unit) }],
});

function listServer(options: Parameters<typeof shoppingServer>[0] = {}) {
  return shoppingServer({
    sections: [primeur, alimentaire, boucher],
    items: [
      buildItem({ sectionId: primeur.id, label: "Avocats", sortOrder: 0 }),
      buildItem({
        sectionId: primeur.id,
        ingredient: {
          id: "00000000-0000-4000-8000-00000000b001",
          name: "oignon",
          namePlural: "oignons",
        },
        parts: [
          { quantity: 500, unitId: unitId("g") },
          { quantity: 3, unitId: null },
        ],
        sources: [source("Gratin", 500), source("Curry de légumes", 3, "piece")],
        sortOrder: 1,
      }),
      buildItem({
        sectionId: primeur.id,
        label: "Citrons",
        checkedAt: NOW,
        sortOrder: 2,
      }),
      buildItem({ sectionId: alimentaire.id, label: "Lait", sortOrder: 0 }),
      buildItem({ sectionId: alimentaire.id, label: "Riz", sortOrder: 1 }),
      buildItem({ sectionId: boucher.id, label: "Steak", checkedAt: NOW, sortOrder: 0 }),
      buildItem({ sectionId: null, label: "Piles", sortOrder: 0 }),
    ],
    ...options,
  });
}

const route = (s: { space: { id: string } }) => `/s/${s.space.id}/shopping`;

describe("module Courses dans l'espace", () => {
  it("apparait dans la navigation quand il est actif", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const links = await screen.findAllByRole("link", { name: "Courses" });
    expect(links[0]).toHaveAttribute("href", route(s));
  });
});

describe("E-COURSES : la liste", () => {
  it("range par section, achetes en fin, compteur unique, Autres en fin", async () => {
    const s = listServer();
    const { container } = renderWithProviders(<App />, { route: route(s) });
    expect(await screen.findByText("5 à acheter")).toBeInTheDocument();

    const sections = within(screen.getByRole("group", { name: "Sections" })).getAllByRole("region");
    expect(sections.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Primeur",
      "Alimentaire",
      "Boucher",
      "Autres",
    ]);
    const primeurItems = within(sections[0]!).getAllByRole("checkbox");
    expect(primeurItems.map((box) => box.getAttribute("aria-label"))).toEqual([
      "Avocats",
      "oignons",
      "Citrons",
    ]);
    expect(primeurItems[2]).toBeChecked();
    expect(within(sections[0]!).getByText("500 g + 3")).toBeInTheDocument();
    expect(within(sections[0]!).getByText("pour : Gratin, Curry de légumes")).toBeInTheDocument();

    // Section entierement cochee : repliee d'elle-meme.
    const meat = within(sections[2]!).getByRole("button", { name: /Boucher/ });
    expect(meat).toHaveAttribute("aria-expanded", "false");
    expect(meat).toHaveTextContent("tout est pris");
    expect(within(sections[2]!).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("une section se replie et se deplie", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    const head = await screen.findByRole("button", { name: /Alimentaire/ });
    expect(head).toHaveAttribute("aria-expanded", "true");
    await user.click(head);
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: "Lait" })).not.toBeInTheDocument();
  });

  it("la case coche l'article et le compteur suit", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("checkbox", { name: "Lait" }));
    expect(screen.getByRole("checkbox", { name: "Lait" })).toBeChecked();
    expect(screen.getByText("4 à acheter")).toBeInTheDocument();
    await waitFor(() => {
      expect(s.shop.patches).toHaveLength(1);
    });
    expect(s.shop.patches[0]).toMatchObject({ checked: true });
    expect(s.shop.patches[0]?.checkedChangedAt).toEqual(expect.any(String));
  });

  it("sans le droit de modifier : lecture seule", async () => {
    const s = listServer({ myRole: "MEMBER", editRole: "MODERATOR" });
    renderWithProviders(<App />, { route: route(s) });
    expect(await screen.findByRole("checkbox", { name: "Lait" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Ajouter un article" })).not.toBeInTheDocument();
    expect(
      await screen.findByText("Seuls les modérateurs et le propriétaire modifient la liste.")
    ).toBeInTheDocument();
  });

  it("liste vide : invitation a ajouter", async () => {
    const s = shoppingServer();
    renderWithProviders(<App />, { route: route(s) });
    expect(await screen.findByText("La liste est vide")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ajouter un article" })).toBeInTheDocument();
  });
});

describe("E-COURSES : ajouter", () => {
  it("Entree ajoute, vide le champ et garde le clavier ouvert", async () => {
    const lemon = buildIngredient("citron", { namePlural: "citrons" });
    const s = listServer({ catalog: [lemon, buildIngredient("citronnelle")] });
    const { user } = renderWithProviders(<App />, { route: route(s) });
    const input = await screen.findByRole("combobox", { name: "Ajouter un article" });

    await user.type(input, "2 citrons");
    // L'ingredient du catalogue est propose en premier, le texte tel quel ensuite.
    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("citron");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /« citrons » tel quel/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(s.shop.created).toEqual([
        { ingredientId: lemon.id, parts: [{ quantity: 2, unitId: null }] },
      ]);
    });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();

    await user.type(input, "éponge{Enter}");
    await waitFor(() => {
      expect(s.shop.created[1]).toEqual({ label: "éponge", parts: [] });
    });
    expect(await screen.findByRole("checkbox", { name: "éponge" })).toBeInTheDocument();
  });

  it("toucher une suggestion l'ajoute", async () => {
    const butter = buildIngredient("beurre");
    const s = listServer({ catalog: [butter] });
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.type(
      await screen.findByRole("combobox", { name: "Ajouter un article" }),
      "250 g beur"
    );
    await user.click(await screen.findByRole("option", { name: /^beurre/ }));
    await waitFor(() => {
      expect(s.shop.created).toEqual([
        { ingredientId: butter.id, parts: [{ quantity: 250, unitId: unitId("g") }] },
      ]);
    });
  });
});

describe("F-ARTICLE : le detail", () => {
  it("le bouton du produit garde son texte visible dans son nom (axe label-content-name-mismatch)", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    const button = await screen.findByRole("button", { name: /^Détail de oignons\b/ });
    expect(button).toHaveAccessibleName(/^Détail de oignons pour : Gratin, Curry de légumes /);
  });

  it("toucher le produit ouvre son detail : d'ou vient la quantite", async () => {
    const s = listServer();
    const { user, container } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("button", { name: /^Détail de oignons\b/ }));
    const sheet = await screen.findByRole("dialog", { name: "oignons" });
    expect(within(sheet).getByText(/Gratin/)).toBeInTheDocument();
    expect(within(sheet).getByText(/Curry de légumes/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("changer de section deplace la ligne ; Toujours ranger ici la memorise", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("button", { name: /^Détail de Lait\b/ }));
    const sheet = await screen.findByRole("dialog", { name: "Lait" });
    expect(within(sheet).getByRole("radio", { name: "Alimentaire" })).toBeChecked();
    await user.click(within(sheet).getByRole("radio", { name: "Primeur" }));
    await waitFor(() => {
      expect(s.shop.patches[0]).toEqual({ itemId: expect.any(String), sectionId: primeur.id });
    });
    await user.click(
      within(sheet).getByRole("button", { name: "Toujours ranger dans « Primeur »" })
    );
    await waitFor(() => {
      expect(s.shop.patches[1]).toEqual({
        itemId: expect.any(String),
        sectionId: primeur.id,
        rememberSection: true,
      });
    });
  });

  it("modifier la quantite", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("button", { name: /^Détail de Riz\b/ }));
    const sheet = await screen.findByRole("dialog", { name: "Riz" });
    await user.type(within(sheet).getByRole("textbox", { name: "Quantité" }), "1 kg");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer la quantité" }));
    await waitFor(() => {
      expect(s.shop.patches[0]).toEqual({
        itemId: expect.any(String),
        parts: [{ quantity: 1, unitId: unitId("kg") }],
      });
    });
  });

  it("Monter et Descendre changent l'ordre dans la section", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("button", { name: /^Détail de Riz\b/ }));
    const sheet = await screen.findByRole("dialog", { name: "Riz" });
    expect(within(sheet).getByRole("button", { name: "Descendre" })).toBeDisabled();
    await user.click(within(sheet).getByRole("button", { name: "Monter" }));
    await waitFor(() => {
      expect(s.shop.orders).toHaveLength(1);
    });
    const [lait, riz] = s.shop.items.filter((i) => i.sectionId === alimentaire.id);
    expect(s.shop.orders[0]).toEqual({ sectionId: alimentaire.id, ids: [riz?.id, lait?.id] });
  });

  it("retirer : sans confirmation, Annuler dans le toast", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await user.click(await screen.findByRole("button", { name: /^Détail de Lait\b/ }));
    const sheet = await screen.findByRole("dialog", { name: "Lait" });
    await user.click(within(sheet).getByRole("button", { name: "Retirer de la liste" }));
    await waitFor(() => {
      expect(s.shop.deleted).toHaveLength(1);
    });
    expect(screen.queryByRole("checkbox", { name: "Lait" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(s.shop.restored).toHaveLength(1);
    });
    expect(s.shop.restored[0]?.items[0]).toMatchObject({
      label: "Lait",
      sectionId: alimentaire.id,
    });
    expect(await screen.findByRole("checkbox", { name: "Lait" })).toBeInTheDocument();
  });
});
