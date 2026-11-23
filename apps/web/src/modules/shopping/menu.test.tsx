// Liste de courses (C9 etape 4c) : menu du module [D228, D231]. Retirer les achetes
// (Annuler dans le toast), Depuis le planning, gerer les sections (ajouter, renommer,
// ordonner, supprimer : ses articles vont dans "Autres"), reglages (role minimal).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { NOW } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { buildItem, buildSection, shoppingServer } from "../../test/shopping-server.ts";

const primeur = buildSection("Primeur");
const alimentaire = buildSection("Alimentaire");
const boucher = buildSection("Boucher");

function menuServer(options: Parameters<typeof shoppingServer>[0] = {}) {
  return shoppingServer({
    sections: [primeur, alimentaire, boucher],
    items: [
      buildItem({ sectionId: primeur.id, label: "Avocats", sortOrder: 0 }),
      buildItem({ sectionId: primeur.id, label: "Citrons", checkedAt: NOW, sortOrder: 1 }),
      buildItem({ sectionId: alimentaire.id, label: "Lait", sortOrder: 0 }),
      buildItem({ sectionId: boucher.id, label: "Steak", checkedAt: NOW, sortOrder: 0 }),
    ],
    ...options,
  });
}

const route = (s: { space: { id: string } }) => `/s/${s.space.id}/shopping`;

async function openMenu(s: { space: { id: string } }) {
  const rendered = renderWithProviders(<App />, { route: route(s) });
  await rendered.user.click(await screen.findByRole("button", { name: "Menu de la liste" }));
  const menu = await screen.findByRole("menu", { name: "Menu de la liste" });
  return { ...rendered, menu };
}

describe("menu du module", () => {
  it("retirer les achetes : la liste se vide de ce qui est coche, Annuler les remet", async () => {
    const s = menuServer();
    const { user, menu } = await openMenu(s);
    await user.click(within(menu).getByRole("menuitem", { name: "Retirer les achetés (2)" }));
    await waitFor(() => {
      expect(s.shop.cleared).toBe(1);
    });
    expect(await screen.findByText("2 articles retirés")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Citrons" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Boucher" })).not.toBeInTheDocument();

    // Le menu se referme (Radix rend alors les clics a la page) avant de toucher Annuler.
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe("none");
    });
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(s.shop.restored).toHaveLength(1);
    });
    expect(s.shop.restored[0]?.items.map((i) => i.label)).toEqual(["Citrons", "Steak"]);
    expect(await screen.findByRole("checkbox", { name: "Citrons" })).toBeInTheDocument();
  });

  it("rien d'achete : retirer est desactive", async () => {
    const s = shoppingServer({ items: [buildItem({ label: "Lait" })] });
    const { menu } = await openMenu(s);
    expect(within(menu).getByRole("menuitem", { name: "Retirer les achetés" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("sans le droit de modifier : pas de menu", async () => {
    const s = menuServer({ myRole: "MEMBER", editRole: "MODERATOR" });
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Lait" });
    expect(screen.queryByRole("button", { name: "Menu de la liste" })).not.toBeInTheDocument();
  });

  it("reglages reserves au proprietaire", async () => {
    const member = menuServer();
    const { menu, unmount } = await openMenu(member);
    expect(within(menu).queryByRole("menuitem", { name: "Réglages" })).not.toBeInTheDocument();
    unmount();
  });
});

describe("gerer les sections", () => {
  async function openSections(s: { space: { id: string } }) {
    const { user, menu, container } = await openMenu(s);
    await user.click(within(menu).getByRole("menuitem", { name: "Gérer les sections" }));
    const sheet = await screen.findByRole("dialog", { name: "Sections" });
    return { user, sheet, container };
  }

  it("liste les sections dans l'ordre, Autres en fin", async () => {
    const s = menuServer();
    const { sheet, container } = await openSections(s);
    const rows = within(within(sheet).getByRole("list", { name: "Sections" })).getAllByRole(
      "listitem"
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Primeur"),
      expect.stringContaining("Alimentaire"),
      expect.stringContaining("Boucher"),
      expect.stringContaining("Autres"),
    ]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("ajouter une section ; un nom deja pris est explique", async () => {
    const s = menuServer();
    const { user, sheet } = await openSections(s);
    const input = within(sheet).getByRole("textbox", { name: "Nouvelle section" });
    await user.type(input, "Pharmacie{Enter}");
    await waitFor(() => {
      expect(s.shop.sectionWrites).toEqual([{ method: "POST", body: { name: "Pharmacie" } }]);
    });
    expect(await within(sheet).findByText("Pharmacie")).toBeInTheDocument();
    expect(input).toHaveValue("");

    await user.type(input, "primeur{Enter}");
    expect(
      await within(sheet).findByText("Une section porte déjà ce nom dans cet espace.")
    ).toBeInTheDocument();
  });

  it("renommer une section", async () => {
    const s = menuServer();
    const { user, sheet } = await openSections(s);
    await user.click(within(sheet).getByRole("button", { name: "Actions de la section Boucher" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renommer" }));
    const field = within(sheet).getByRole("textbox", { name: "Nom de la section" });
    await user.clear(field);
    await user.type(field, "Boucherie{Enter}");
    await waitFor(() => {
      expect(s.shop.sectionWrites).toEqual([
        { method: "PATCH", sectionId: boucher.id, body: { name: "Boucherie" } },
      ]);
    });
    expect(await within(sheet).findByText("Boucherie")).toBeInTheDocument();
  });

  it("monter une section change l'ordre du magasin", async () => {
    const s = menuServer();
    const { user, sheet } = await openSections(s);
    await user.click(
      within(sheet).getByRole("button", { name: "Actions de la section Alimentaire" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
    await waitFor(() => {
      expect(s.shop.sectionWrites).toEqual([
        { method: "ORDER", body: { ids: [alimentaire.id, primeur.id, boucher.id] } },
      ]);
    });
  });

  it("supprimer : ses articles vont dans Autres, apres confirmation dans la feuille", async () => {
    const s = menuServer();
    const { user, sheet } = await openSections(s);
    await user.click(
      within(sheet).getByRole("button", { name: "Actions de la section Alimentaire" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    expect(
      within(sheet).getByText("Supprimer « Alimentaire » ? Son article passe dans Autres.")
    ).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Supprimer « Alimentaire »" }));
    await waitFor(() => {
      expect(s.shop.sectionWrites).toEqual([{ method: "DELETE", sectionId: alimentaire.id }]);
    });
    await user.keyboard("{Escape}");
    const others = await screen.findByRole("region", { name: "Autres" });
    expect(within(others).getByRole("checkbox", { name: "Lait" })).toBeInTheDocument();
  });
});

describe("reglages du module", () => {
  it("le proprietaire choisit qui modifie la liste", async () => {
    const s = menuServer({ myRole: "OWNER" });
    const { user, menu } = await openMenu(s);
    await user.click(within(menu).getByRole("menuitem", { name: "Réglages" }));
    const sheet = await screen.findByRole("dialog", { name: "Réglages des courses" });
    expect(within(sheet).getByRole("radio", { name: /Membres et plus/ })).toBeChecked();
    await user.click(within(sheet).getByRole("radio", { name: /Modérateurs/ }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.shop.settingsPuts).toEqual([{ editRole: "MODERATOR" }]);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Réglages des courses" })
      ).not.toBeInTheDocument();
    });
  });
});
