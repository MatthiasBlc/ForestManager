// Partage des recettes (C3.5) : F-PARTAGER, F-PARTAGER-Demande, demandes recues
// (F-DEMANDE-PARTAGE), "Mes recettes" (D82), retrait d'un espace (F-REC-9), F-QUITTER (D84).
import type { ShareRequest } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildSpaceDetail, uuid } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  localStorage.clear();
});

const amis = () => buildSpaceDetail({ name: "Amis", tintIndex: 4, myRole: "MEMBER" });
const tom = () => buildSpaceDetail({ name: "TOM", tintIndex: 3, myRole: "MEMBER" });

async function openShare(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Partager dans un espace" }));
}

describe("partager sa recette (F-PARTAGER)", () => {
  it("l'auteur coche ses espaces ; l'origine est grisee, la sous-recette suit", async () => {
    const extra = amis();
    const s = recipeServer({ extraSpaces: [extra] });
    const recipe = s.add({ title: "Saumon teriyaki" });
    s.recipes.sharing[recipe.id] = {
      withIt: [{ id: uuid(), title: "Sauce teriyaki", included: true }],
    };
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await openShare(user);
    const sheet = await screen.findByRole("dialog", { name: "Partager dans tes espaces" });
    expect(within(sheet).getByText("Espace d'origine")).toBeInTheDocument();
    expect(within(sheet).queryByRole("switch", { name: "matthias" })).not.toBeInTheDocument();
    expect(within(sheet).getByText("Sauce teriyaki")).toBeInTheDocument();
    const amisSwitch = within(sheet).getByRole("switch", { name: "Amis" });
    expect(amisSwitch).not.toBeChecked();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(amisSwitch);
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.shares).toEqual({ spaceIds: [extra.id] });
    });
    expect(await screen.findByText("Partagée dans Amis")).toBeInTheDocument();
  });

  it("decocher un espace retire le partage", async () => {
    const extra = amis();
    const s = recipeServer({ extraSpaces: [extra] });
    const recipe = s.add();
    s.recipes.sharing[recipe.id] = { spaces: [{ spaceId: extra.id, status: "SHARED" }] };
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await openShare(user);
    const sheet = await screen.findByRole("dialog", { name: "Partager dans tes espaces" });
    const amisSwitch = await within(sheet).findByRole("switch", { name: "Amis" });
    await waitFor(() => {
      expect(amisSwitch).toBeChecked();
    });
    await user.click(amisSwitch);
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.recipes.bodies.shares).toEqual({ spaceIds: [] });
    });
    expect(await screen.findByText("Partage mis à jour")).toBeInTheDocument();
  });
});

describe("demander le partage (F-PARTAGER-Demande)", () => {
  it("vers un espace ou elle n'est ni partagee ni demandee, avec un mot", async () => {
    const [a, t] = [amis(), tom()];
    const s = recipeServer({ extraSpaces: [a, t] });
    const recipe = s.add({
      title: "Gratin de pâtes",
      author: { id: uuid(), username: "lea", avatarUrl: null },
      can: { edit: false, delete: false, share: false },
    });
    s.recipes.sharing[recipe.id] = { spaces: [{ spaceId: a.id, status: "PENDING" }] };
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await openShare(user);
    const sheet = await screen.findByRole("dialog", { name: "Partager dans un autre espace" });
    expect(within(sheet).getByText(/Cette recette est celle de lea/)).toBeInTheDocument();
    const targets = await within(sheet).findByRole("group", { name: "Espace cible" });
    expect(within(targets).queryByRole("button", { name: "Amis" })).not.toBeInTheDocument();
    expect(within(targets).queryByRole("button", { name: "Famille" })).not.toBeInTheDocument();
    await user.click(within(targets).getByRole("button", { name: "TOM" }));
    await user.type(within(sheet).getByLabelText("Un mot pour lea (facultatif)"), "Pour Noël");
    await user.click(within(sheet).getByRole("button", { name: "Envoyer la demande" }));
    await waitFor(() => {
      expect(s.recipes.bodies.shareRequest).toEqual({
        targetSpaceId: t.id,
        message: "Pour Noël",
      });
    });
    expect(await screen.findByText("Demande envoyée à lea")).toBeInTheDocument();
  });

  it("partage immediat si l'auteur fait confiance", async () => {
    const t = tom();
    const s = recipeServer({ extraSpaces: [t] });
    const recipe = s.add({
      author: { id: uuid(), username: "lea", avatarUrl: null },
      can: { edit: false, delete: false, share: false },
    });
    s.recipes.requestResult = "SHARED";
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await openShare(user);
    const sheet = await screen.findByRole("dialog", { name: "Partager dans un autre espace" });
    await within(sheet).findByRole("group", { name: "Espace cible" });
    await user.click(within(sheet).getByRole("button", { name: "Envoyer la demande" }));
    expect(await screen.findByText("Partagée dans TOM")).toBeInTheDocument();
    expect(s.recipes.bodies.shareRequest).toEqual({ targetSpaceId: t.id });
  });
});

describe("demandes recues (F-DEMANDE-PARTAGE)", () => {
  function request(s: ReturnType<typeof recipeServer>, over: Partial<ShareRequest> = {}) {
    const value: ShareRequest = {
      id: uuid(),
      recipe: { id: uuid(), title: "Gratin de pâtes" },
      homeSpace: { id: s.space.id, name: "Famille" },
      sourceSpace: { id: s.space.id, name: "Famille" },
      targetSpace: { id: uuid(), name: "Amis", memberCount: 6 },
      requester: { id: uuid(), username: "sam", avatarUrl: null },
      message: "Ta tante la réclame depuis Noël !",
      createdAt: new Date().toISOString(),
      trust: false,
      ...over,
    };
    s.recipes.shareRequests.push(value);
    return value;
  }

  it("bandeau sur la liste, accepter en faisant confiance", async () => {
    const s = recipeServer();
    const req = request(s);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click(await screen.findByRole("button", { name: /1 demande de partage/ }));
    const sheet = screen.getByRole("dialog", { name: "Demande de partage" });
    expect(within(sheet).getByText(/sam voudrait partager/)).toBeInTheDocument();
    expect(within(sheet).getByText(/ses 6 membres la verront/)).toBeInTheDocument();
    expect(within(sheet).getByText("« Ta tante la réclame depuis Noël ! »")).toBeInTheDocument();
    await user.click(
      within(sheet).getByRole("switch", {
        name: "Les membres de Famille peuvent partager mes recettes sans me demander",
      })
    );
    await user.click(within(sheet).getByRole("button", { name: "Accepter" }));
    await waitFor(() => {
      expect(s.recipes.bodies[`approve:${req.id}`]).toEqual({ trustMembers: true });
    });
    expect(await screen.findByText("Partagée dans Amis")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /demande de partage/ })).not.toBeInTheDocument();
    });
  });

  it("un moderateur refuse ; pas de reglage de confiance s'il n'est pas l'auteur", async () => {
    const s = recipeServer({ myRole: "MODERATOR" });
    const req = request(s, { trust: null });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click(await screen.findByRole("button", { name: /1 demande de partage/ }));
    const sheet = screen.getByRole("dialog", { name: "Demande de partage" });
    expect(within(sheet).queryByRole("switch")).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Refuser" }));
    await waitFor(() => {
      expect(s.state.calls).toContain(`reject:${req.id}`);
    });
    expect(await screen.findByText("Demande refusée")).toBeInTheDocument();
  });
});

describe("mes recettes (D82) et recettes partagees", () => {
  it("l'espace perso liste mes recettes de tous les espaces, ouvertes dans leur origine", async () => {
    const s = recipeServer();
    s.add({ title: "Dahl de lentilles" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.personal.id}/recipes` });
    expect(await screen.findByRole("heading", { name: "Mes recettes" })).toBeInTheDocument();
    const card = await screen.findByRole("article", { name: "Dahl de lentilles" });
    expect(within(card).getByText("Famille")).toBeInTheDocument();
    await user.click(card);
    expect(
      await screen.findByRole("heading", { name: "Dahl de lentilles", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/par matthias · révision 1/)).toBeInTheDocument();
  });

  it("onglet unique de l'espace perso (D207) : filtre par espace d'origine", async () => {
    const s = recipeServer();
    s.add({ title: "Dahl de lentilles" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.personal.id}/recipes` });
    await screen.findByRole("article", { name: "Dahl de lentilles" });
    const spaces = screen.getByRole("group", { name: "Espaces" });
    expect(within(spaces).getByRole("button", { name: "Tous les espaces" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(spaces).getByRole("button", { name: "Perso" })).toBeInTheDocument();
    await user.click(within(spaces).getByRole("button", { name: "Famille" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("homeSpaceId")).toBe(s.space.id);
    });
    await user.click(within(spaces).getByRole("button", { name: "Perso" }));
    await waitFor(() => {
      expect(s.recipes.queries.at(-1)?.get("homeSpaceId")).toBe(s.personal.id);
    });
  });

  it("l'ancien lien Mes recettes mene a l'onglet unique (D207)", async () => {
    const s = recipeServer();
    s.add({ title: "Dahl de lentilles" });
    renderWithProviders(<App />, { route: `/s/${s.personal.id}/recipes/mine` });
    expect(await screen.findByRole("heading", { name: "Mes recettes" })).toBeInTheDocument();
    expect(await screen.findByRole("article", { name: "Dahl de lentilles" })).toBeInTheDocument();
  });

  it("une recette partagee porte un badge et son origine", async () => {
    const s = recipeServer();
    s.add({
      title: "Tarte aux pommes",
      homeSpaceId: uuid(),
      author: { id: uuid(), username: "lea", avatarUrl: null },
    });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    const card = await screen.findByRole("article", { name: "Tarte aux pommes" });
    expect(within(card).getByText("Partagée")).toBeInTheDocument();
    await user.click(card);
    expect(await screen.findByText(/par lea · Foyer/)).toBeInTheDocument();
  });

  it("retirer de l'espace de partage (F-REC-9)", async () => {
    const s = recipeServer();
    const recipe = s.add({
      title: "Tarte aux pommes",
      homeSpaceId: uuid(),
      can: { edit: false, delete: false, share: false, removeFromSpace: true },
    });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Retirer de Famille" }));
    const sheet = screen.getByRole("dialog", { name: "Retirer « Tarte aux pommes » de Famille ?" });
    expect(within(sheet).getByText(/reste dans Foyer/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Retirer" }));
    await waitFor(() => {
      expect(s.state.calls).toContain(`unshare:${recipe.id}`);
    });
    expect(await screen.findByText("Recette retirée de Famille")).toBeInTheDocument();
  });

  it("la suppression previent des espaces de partage", async () => {
    const s = recipeServer();
    const recipe = s.add({
      sharedIn: [
        { id: uuid(), name: "Amis" },
        { id: uuid(), name: "TOM" },
      ],
      shareCount: 2,
    });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await user.click(await screen.findByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    const sheet = screen.getByRole("dialog", { name: /Supprimer/ });
    expect(within(sheet).getByText(/Elle disparaît aussi de Amis et TOM/)).toBeInTheDocument();
  });
});

describe("quitter un espace avec des recettes perso partagees (F-QUITTER, D84)", () => {
  it("laisser ou retirer chaque recette, les retraits avant le depart", async () => {
    const s = recipeServer();
    const dahl = s.add({ title: "Dahl de lentilles corail", homeSpaceId: s.personal.id });
    const tarte = s.add({ title: "Tarte aux pommes", homeSpaceId: s.personal.id });
    s.recipes.leavePreview = {
      createdHere: 4,
      personalShared: [
        { id: dahl.id, title: dahl.title },
        { id: tarte.id, title: tarte.title },
      ],
    };
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Quitter Famille" }));
    const sheet = screen.getByRole("dialog", { name: "Quitter Famille" });
    expect(
      await within(sheet).findByText(/Les 4 recettes que tu as créées dans Famille y restent/)
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("Tes recettes perso partagées dans Famille")
    ).toBeInTheDocument();
    const dahlChoice = within(sheet).getByRole("group", { name: "Dahl de lentilles corail" });
    await user.click(within(dahlChoice).getByRole("button", { name: "Retirer de Famille" }));
    await user.click(within(sheet).getByRole("button", { name: "Quitter Famille" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("leave");
    });
    expect(s.state.calls.filter((c) => c.startsWith("unshare:") || c === "leave")).toEqual([
      `unshare:${dahl.id}`,
      "leave",
    ]);
  });
});
