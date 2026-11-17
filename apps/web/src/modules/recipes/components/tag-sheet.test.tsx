// F-TAGS [D216] : un seul composant de choix de tags (feuille, recherche, familles).
import type { TagCatalog } from "@fm/shared";
import { screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "../../../test/axe.ts";
import { uuid } from "../../../test/fixtures.ts";
import { renderWithProviders } from "../../../test/render.tsx";
import { TagSheet, type TagSheetProps } from "./tag-sheet.tsx";

const saison = { id: uuid(), scope: "GLOBAL" as const, name: "Saison" };
const categorie = { id: uuid(), scope: "SPACE" as const, name: "Catégorie" };
const tag = (name: string, familyId: string | null, recipeCount: number, scope = "GLOBAL") => ({
  id: uuid(),
  scope: scope as "GLOBAL" | "SPACE",
  name,
  familyId,
  recipeCount,
});
const hiver = tag("Hiver", saison.id, 42);
const automne = tag("Automne", saison.id, 45);
const ete = tag("Été", saison.id, 0);
const gratins = tag("Gratins", categorie.id, 12, "SPACE");
const rapide = tag("Rapide", null, 37);
const catalog: TagCatalog = {
  families: [saison, categorie],
  tags: [automne, ete, gratins, hiver, rapide],
};

function Harness(props: Partial<TagSheetProps> & { onIds?: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>([]);
  return (
    <TagSheet
      open
      onClose={() => undefined}
      title="Filtres"
      catalog={catalog}
      spaceName="Le Nid"
      selected={ids}
      onChange={(next) => {
        setIds(next);
        props.onIds?.(next);
      }}
      {...props}
    />
  );
}

describe("feuille de tags (F-TAGS)", () => {
  it("groupe les tags par famille, dans l'ordre, puis Autres", async () => {
    const { baseElement } = renderWithProviders(<Harness />);
    const sheet = screen.getByRole("dialog", { name: "Filtres" });
    const groups = within(sheet).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
      "Saison",
      "Catégorie · Le Nid",
      "Autres",
    ]);
    expect(
      within(groups[0]!)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Automne", "Été", "Hiver"]);
    expect(await axeViolations(baseElement)).toEqual([]);
  });

  it("avec les nombres : montre le nombre de recettes et masque les tags sans recette", () => {
    renderWithProviders(<Harness counts />);
    expect(screen.getByRole("button", { name: "Hiver, 42 recettes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Été/ })).not.toBeInTheDocument();
  });

  it("choix multiple : toucher coche et decoche", async () => {
    const onIds = vi.fn();
    const { user } = renderWithProviders(<Harness onIds={onIds} />);
    await user.click(screen.getByRole("button", { name: "Hiver" }));
    await user.click(screen.getByRole("button", { name: "Gratins" }));
    expect(screen.getByRole("button", { name: "Hiver" })).toHaveAttribute("aria-pressed", "true");
    expect(onIds).toHaveBeenLastCalledWith([hiver.id, gratins.id]);
    await user.click(screen.getByRole("button", { name: "Hiver" }));
    expect(onIds).toHaveBeenLastCalledWith([gratins.id]);
  });

  it("choix unique : toucher un tag le choisit et ferme", async () => {
    const onClose = vi.fn();
    const onIds = vi.fn();
    const { user } = renderWithProviders(<Harness mode="single" onClose={onClose} onIds={onIds} />);
    await user.click(screen.getByRole("button", { name: "Gratins" }));
    expect(onIds).toHaveBeenLastCalledWith([gratins.id]);
    expect(onClose).toHaveBeenCalled();
  });

  it("recherche sans accents ni casse", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.type(screen.getByRole("searchbox", { name: "Chercher un tag" }), "ete");
    expect(screen.getByRole("button", { name: "Été" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hiver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Autres" })).not.toBeInTheDocument();
  });

  it("cree un tag d'espace quand la recherche ne trouve pas ce nom", async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { user } = renderWithProviders(<Harness create={onCreate} />);
    const search = screen.getByRole("searchbox", { name: "Chercher un tag" });
    await user.type(search, "hiver");
    expect(screen.queryByRole("button", { name: /Créer le tag/ })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, " Raclette ");
    await user.click(
      screen.getByRole("button", { name: /^Créer le tag « Raclette » dans Le Nid/ })
    );
    expect(onCreate).toHaveBeenCalledWith("Raclette");
  });
});
