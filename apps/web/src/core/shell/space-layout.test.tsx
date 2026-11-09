import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { mockSession } from "../../test/session.ts";

function session() {
  const me = buildMe();
  const family = buildSpaceDetail({ name: "Famille", tintIndex: 3 });
  const tom = buildSpaceDetail({
    name: "TOM",
    tintIndex: 4,
    deletedAt: "2026-11-01T10:00:00.000Z",
    purgeAfter: new Date(Date.now() + 12 * 24 * 3600 * 1000 - 1000).toISOString(),
  });
  mockSession({ me, spaces: [buildPersonalSpace(me), family, tom] });
  return { me, family, tom };
}

describe("shell d'un espace", () => {
  it("rail, barre du module, teinte de l'espace et page du module", async () => {
    const { family } = session();
    renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });

    const rail = await screen.findByRole("navigation", { name: "Espaces" });
    await waitFor(() => {
      expect(
        within(rail)
          .getAllByRole("button")
          .map((b) => b.getAttribute("aria-label"))
      ).toEqual([
        "matthias",
        "Famille",
        "TOM, suppression dans 12 jours",
        "Créer ou rejoindre un espace",
      ]);
    });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Recettes", "Membres", "Activité", "Réglages"]);
    expect(within(nav).getByRole("link", { name: "Recettes" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByRole("heading", { name: "Recettes" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-space", "3");
  });

  it("l'espace seul ouvre sa premiere entree ; le rail change d'espace", async () => {
    const { me, family } = session();
    const { user } = renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}` });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await waitFor(() => {
      expect(within(nav).getByRole("link", { name: "Accueil" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
    await user.click(screen.getByRole("button", { name: "Famille" }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-space", "3");
    });
    expect(
      within(await screen.findByRole("complementary", { name: "Modules de l'espace" })).getByRole(
        "link",
        { name: "Membres" }
      )
    ).toHaveAttribute("href", `/s/${family.id}/members`);
  });

  it("Plus ouvre les entrees restantes en feuille", async () => {
    const { family } = session();
    const { user } = renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });
    const tabs = await screen.findByRole("navigation", { name: "Navigation" });
    await user.click(within(tabs).getByRole("button", { name: "Plus" }));
    const sheet = screen.getByRole("dialog", { name: "Plus" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Membres", "Activité", "Réglages"]);
  });

  it("le bouton d'espace (mobile) ouvre la liste des espaces", async () => {
    const { family } = session();
    const { user } = renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });
    await user.click(
      await screen.findByRole("button", { name: /Changer d'espace, espace courant : Famille/ })
    );
    const sheet = screen.getByRole("dialog", { name: "Espaces" });
    expect(within(sheet).getByRole("button", { name: "Famille" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("espace introuvable : message et retour a l'espace perso", async () => {
    const { me } = session();
    renderWithProviders(<App />, { route: "/s/00000000-0000-4000-8000-000000000000/recipes" });
    expect(await screen.findByRole("heading", { name: "Espace introuvable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revenir à mon espace" })).toHaveAttribute(
      "href",
      `/s/${me.personalSpaceId}`
    );
  });

  it("la racine ouvre le dernier espace visite, sinon l'espace perso (D60)", async () => {
    const { me, family } = session();
    localStorage.removeItem("fm:lastSpace");
    const first = renderWithProviders(<App />, { route: "/" });
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "Accueil" })[0]).toHaveAttribute(
        "href",
        `/s/${me.personalSpaceId}/home`
      );
    });
    first.unmount();
    localStorage.setItem("fm:lastSpace", family.id);
    renderWithProviders(<App />, { route: "/" });
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-space", "3");
    });
  });
});
