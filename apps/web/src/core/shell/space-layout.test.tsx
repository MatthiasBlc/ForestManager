import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";
import { spaceServer } from "../../test/space-server.ts";

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
      expect(within(rail).getAllByRole("button")).toHaveLength(4);
    });
    const railNames = ["matthias", "Famille", "TOM, suppression dans 12 jours"];
    for (const name of [...railNames, "Créer ou rejoindre un espace"])
      expect(within(rail).getByRole("button", { name })).toBeInTheDocument();
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

  it("un espace de groupe mene a l'Accueil en un geste (mobile) ; pas dans l'espace perso", async () => {
    const { me, family } = session();
    const { unmount } = renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });
    const banner = await screen.findByRole("banner");
    expect(await within(banner).findByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      `/s/${me.personalSpaceId}/home`
    );
    unmount();
    renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    const own = await screen.findByRole("banner");
    await within(own).findByRole("button", { name: /changer d'espace/ });
    expect(within(own).queryByRole("link", { name: "Accueil" })).not.toBeInTheDocument();
  });

  it("le bouton d'espace (mobile) ouvre la liste des espaces", async () => {
    const { family } = session();
    const { user } = renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });
    await user.click(await screen.findByRole("button", { name: /^Famille.*changer d'espace/ }));
    const sheet = screen.getByRole("dialog", { name: "Espaces" });
    expect(within(sheet).getByRole("button", { name: /^Famille/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("relecture de l'espace en echec reseau : l'espace deja lu reste affiche (D35)", async () => {
    const { family } = session();
    const { client } = renderWithProviders(<App />, { route: `/s/${family.id}/recipes` });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    server.use(http.get("/api/v1/spaces/:spaceId", () => HttpResponse.error()));
    await act(async () => {
      await client.refetchQueries({ queryKey: ["spaces", family.id] });
    });
    expect(client.getQueryState(["spaces", family.id])?.status).toBe("error");
    expect(screen.queryByRole("heading", { name: "Espace introuvable" })).not.toBeInTheDocument();
    expect(nav).toBeInTheDocument();
    expect(nav).toBeVisible();
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

  it("la racine reprend aussi la derniere entree visitee de cet espace (D60)", async () => {
    // Faux serveur complet : la page Membres lit membres, invitations et transfert.
    const { space: family } = spaceServer();
    const visit = renderWithProviders(<App />, { route: `/s/${family.id}/members` });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await waitFor(() => {
      expect(within(nav).getByRole("link", { name: "Membres" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
    visit.unmount();

    renderWithProviders(<App />, { route: "/" });
    const resumed = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await waitFor(() => {
      expect(within(resumed).getByRole("link", { name: "Membres" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  });

  it("une entree memorisee qui n'existe plus retombe sur la premiere (D60)", async () => {
    const { family } = session();
    localStorage.setItem("fm:lastSpace", family.id);
    localStorage.setItem(
      "fm:lastSection",
      JSON.stringify({ spaceId: family.id, path: "shopping" })
    );
    renderWithProviders(<App />, { route: "/" });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await waitFor(() => {
      expect(within(nav).getByRole("link", { name: "Recettes" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  });

  it("changer d'espace par le rail ouvre toujours sa premiere entree", async () => {
    const { family } = session();
    localStorage.setItem("fm:lastSection", JSON.stringify({ spaceId: family.id, path: "members" }));
    renderWithProviders(<App />, { route: `/s/${family.id}` });
    const nav = await screen.findByRole("complementary", { name: "Modules de l'espace" });
    await waitFor(() => {
      expect(within(nav).getByRole("link", { name: "Recettes" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  });
});
