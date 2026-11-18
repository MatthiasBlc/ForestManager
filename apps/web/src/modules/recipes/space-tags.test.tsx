// E-TAGS-ESPACE [D216] : Reglages de l'espace > Tags, pour les moderateurs :
// familles de l'espace (creer, renommer, ordonner, supprimer), tags avec leur
// nombre de recettes (renommer, changer de famille, fusionner, supprimer).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { uuid } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

function withFamilies() {
  const s = recipeServer({ myRole: "MODERATOR" });
  const palier = { id: uuid(), scope: "SPACE" as const, name: "Palier" };
  const saison = { id: uuid(), scope: "SPACE" as const, name: "Saison" };
  s.recipes.tagFamilies.push(palier, saison);
  const regulier = { id: uuid(), scope: "SPACE" as const, name: "Régulier" };
  s.recipes.spaceTags.push(regulier);
  s.recipes.familyOf[regulier.id] = palier.id;
  return { s, palier, saison, regulier, sunday: s.recipes.spaceTags[0]! };
}

describe("tags de l'espace (E-TAGS-ESPACE, D216)", () => {
  it("lien dans les reglages pour un moderateur, pas pour un membre", async () => {
    const s = recipeServer({ myRole: "MODERATOR" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("link", { name: /Tags de l'espace/ }));
    expect(await screen.findByRole("heading", { name: "Tags de Famille" })).toBeInTheDocument();

    const member = recipeServer();
    renderWithProviders(<App />, { route: `/s/${member.space.id}/settings` });
    await screen.findAllByRole("heading", { name: /Réglages de/ });
    expect(screen.queryAllByRole("link", { name: /Tags de l'espace/ })).toHaveLength(0);
  });

  it("familles dans leur ordre puis Autres, tags avec leur nombre de recettes", async () => {
    const { s } = withFamilies();
    const { container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/tags`,
    });
    const palier = await screen.findByRole("region", { name: "Palier" });
    expect(within(palier).getByText("Régulier")).toBeInTheDocument();
    expect(within(palier).getByText("0 recette")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Saison" })).toHaveTextContent("Aucun tag");
    expect(
      within(screen.getByRole("region", { name: "Autres" })).getByText("Plat du dimanche")
    ).toBeInTheDocument();
    // Les tags globaux se reglent dans l'admin, pas ici.
    expect(screen.queryByText("Végétarien")).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("cree, renomme, ordonne et supprime les familles", async () => {
    const { s, palier, saison } = withFamilies();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/tags` });
    await user.click(await screen.findByRole("button", { name: "Nouvelle famille" }));
    let sheet = screen.getByRole("dialog", { name: "Nouvelle famille" });
    await user.type(within(sheet).getByLabelText("Nom"), "Catégorie");
    await user.click(within(sheet).getByRole("button", { name: "Créer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.createFamily).toEqual({ name: "Catégorie" });
    });

    await user.click(screen.getByRole("button", { name: "Actions de la famille Saison" }));
    await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
    await waitFor(() => {
      expect(s.recipes.bodies.familyOrder).toEqual({
        ids: [saison.id, palier.id, expect.any(String)],
      });
    });

    await user.click(screen.getByRole("button", { name: "Actions de la famille Palier" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renommer" }));
    sheet = screen.getByRole("dialog", { name: "Renommer « Palier »" });
    await user.clear(within(sheet).getByLabelText("Nom"));
    await user.type(within(sheet).getByLabelText("Nom"), "Fréquence");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.renameFamily).toEqual({ name: "Fréquence" });
    });

    await user.click(
      await screen.findByRole("button", { name: "Actions de la famille Fréquence" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    sheet = screen.getByRole("dialog", { name: "Supprimer « Fréquence » ?" });
    expect(within(sheet).getByText(/ses tags passent dans « Autres »/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(s.recipes.calls).toContain(`delete-family:${palier.id}`);
    });
  });

  it("ordonne les tags d'une famille ; pas d'ordre dans Autres", async () => {
    const { s, palier, regulier } = withFamilies();
    const rare = { id: uuid(), scope: "SPACE" as const, name: "Occasionnel" };
    s.recipes.spaceTags.push(rare);
    s.recipes.familyOf[rare.id] = palier.id;
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/tags` });
    await user.click(await screen.findByRole("button", { name: "Actions du tag Occasionnel" }));
    await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
    await waitFor(() => {
      expect(s.recipes.bodies.tagOrder).toEqual({
        familyId: palier.id,
        ids: [rare.id, regulier.id],
      });
    });
    await user.click(screen.getByRole("button", { name: "Actions du tag Occasionnel" }));
    expect(await screen.findByRole("menuitem", { name: "Monter" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Actions du tag Plat du dimanche" }));
    await screen.findByRole("menuitem", { name: "Renommer" });
    expect(screen.queryByRole("menuitem", { name: "Monter" })).not.toBeInTheDocument();
  });

  it("renomme un tag, change sa famille, le fusionne, le supprime", async () => {
    const { s, saison, regulier, sunday } = withFamilies();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/tags` });
    await user.click(
      await screen.findByRole("button", { name: "Actions du tag Plat du dimanche" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Changer de famille" }));
    let sheet = screen.getByRole("dialog", { name: "Famille de « Plat du dimanche »" });
    await user.selectOptions(within(sheet).getByLabelText("Famille"), "Saison");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.patchTag).toEqual({ familyId: saison.id });
    });

    await user.click(screen.getByRole("button", { name: "Actions du tag Régulier" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renommer" }));
    sheet = screen.getByRole("dialog", { name: "Renommer « Régulier »" });
    await user.clear(within(sheet).getByLabelText("Nom"));
    await user.type(within(sheet).getByLabelText("Nom"), "Souvent");
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.patchTag).toEqual({ name: "Souvent" });
    });

    await user.click(await screen.findByRole("button", { name: "Actions du tag Souvent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Fusionner" }));
    sheet = screen.getByRole("dialog", { name: "Fusionner « Souvent »" });
    await user.selectOptions(within(sheet).getByLabelText("Fusionner dans"), "Plat du dimanche");
    await user.click(within(sheet).getByRole("button", { name: "Fusionner" }));
    await waitFor(() => {
      expect(s.recipes.bodies.mergeTag).toEqual({ intoTagId: sunday.id });
    });

    await user.click(
      await screen.findByRole("button", { name: "Actions du tag Plat du dimanche" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    sheet = screen.getByRole("dialog", { name: "Supprimer « Plat du dimanche » ?" });
    await user.click(within(sheet).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(s.recipes.calls).toContain(`delete-tag:${sunday.id}`);
    });
    expect(regulier).toBeDefined();
  });
});
