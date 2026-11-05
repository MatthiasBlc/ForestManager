import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { spaceServer } from "../../test/space-server.ts";

describe("creer un espace (F-CREER-ESPACE)", () => {
  it("depuis le rail : nom et couleur, puis ouverture du nouvel espace", async () => {
    const s = spaceServer();
    const created = buildSpaceDetail({ name: "Colloc", tintIndex: 2 });
    let body: unknown;
    server.use(
      http.post("/api/v1/spaces", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(`/api/v1/spaces/${created.id}`, () => HttpResponse.json(created))
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
    await user.click(await screen.findByRole("button", { name: "Créer ou rejoindre un espace" }));
    const sheet = screen.getByRole("dialog", { name: "Créer un espace" });
    await user.type(within(sheet).getByLabelText("Nom de l'espace"), "Colloc");
    await user.click(within(sheet).getByRole("radio", { name: "Nuit" }));
    await user.click(within(sheet).getByRole("button", { name: "Créer l'espace" }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-space", "2");
    });
    expect(body).toEqual({ name: "Colloc", tintIndex: 2 });
    expect(await screen.findByText("Espace créé")).toBeInTheDocument();
  });

  it("le lien de bienvenue ouvre la creation (?create=1)", async () => {
    const s = spaceServer();
    renderWithProviders(<App />, { route: `/s/${s.personal.id}/home?create=1` });
    expect(await screen.findByRole("dialog", { name: "Créer un espace" })).toBeInTheDocument();
  });
});

describe("membres (E-MEMBRES)", () => {
  it("liste les roles ; l'OWNER promeut et exclut apres confirmation", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    expect(await screen.findByRole("heading", { name: "Membres de Famille" })).toBeInTheDocument();
    const rows = await screen.findAllByRole("listitem", { name: /lea|sam|matthias/ });
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual(["matthias", "lea", "sam"]);
    expect(within(rows[1]!).getByText("Modérateur")).toBeInTheDocument();

    await user.click(within(rows[2]!).getByRole("button", { name: "Actions pour sam" }));
    await user.click(screen.getByRole("menuitem", { name: "Promouvoir modérateur" }));
    await waitFor(() => {
      expect(s.state.bodies.role).toEqual({ userId: s.sam.user.id, role: "MODERATOR" });
    });

    await user.click(within(rows[1]!).getByRole("button", { name: "Actions pour lea" }));
    await user.click(screen.getByRole("menuitem", { name: "Exclure de l'espace" }));
    const confirm = screen.getByRole("dialog", { name: "Exclure lea" });
    await user.click(within(confirm).getByRole("button", { name: "Exclure lea" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("exclude");
    });
    await waitFor(() => {
      expect(screen.queryByRole("listitem", { name: "lea" })).not.toBeInTheDocument();
    });
  });

  it("un MEMBER ne voit ni actions ni invitations", async () => {
    const s = spaceServer({ myRole: "MEMBER" });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await screen.findAllByRole("listitem", { name: /lea/ });
    expect(screen.queryByRole("button", { name: /Actions pour/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inviter" })).not.toBeInTheDocument();
    expect(screen.queryByText("Invitations en attente")).not.toBeInTheDocument();
  });

  it("annule une invitation en attente", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    const pending = await screen.findByRole("region", { name: "Invitations en attente" });
    await user.click(within(pending).getByRole("button", { name: "Annuler l'invitation de hugo" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("cancelInvitation");
    });
  });
});

describe("inviter (F-INVITER, D94, D150)", () => {
  it("par lien : duree, nombre de personnes, lien a copier, liens actifs revocables", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await user.click(await screen.findByRole("button", { name: "Inviter" }));
    const sheet = screen.getByRole("dialog", { name: "Inviter dans Famille" });
    await user.click(within(sheet).getByRole("radio", { name: "30 jours" }));
    await user.click(within(sheet).getByRole("button", { name: "Plus" }));
    await user.click(within(sheet).getByRole("button", { name: "Créer le lien" }));
    expect(
      await within(sheet).findByDisplayValue(/\/join\/k7Q2pX9aAbCdEfGhIjKlMn$/)
    ).toBeInTheDocument();
    expect(s.state.bodies.createLink).toEqual({ expiresInDays: 30, maxUses: 4 });
    expect(within(sheet).getByRole("button", { name: "Copier" })).toBeInTheDocument();
    const active = within(sheet).getByRole("region", { name: "Liens actifs" });
    await user.click(await within(active).findByRole("button", { name: "Révoquer" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("revoke");
    });
  });

  it("par nom d'utilisateur : message neutre", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/members` });
    await user.click(await screen.findByRole("button", { name: "Inviter" }));
    const sheet = screen.getByRole("dialog", { name: "Inviter dans Famille" });
    await user.click(within(sheet).getByRole("button", { name: "Par nom d'utilisateur" }));
    await user.type(within(sheet).getByLabelText("Nom d'utilisateur exact"), "claire");
    await user.click(within(sheet).getByRole("button", { name: "Inviter" }));
    expect(await within(sheet).findByRole("status")).toHaveTextContent(
      "Si ce compte existe, il recevra l'invitation."
    );
    expect(s.state.bodies.invite).toEqual({ username: "claire" });
  });
});

describe("reglages, depart, suppression, transfert", () => {
  it("modifie nom, description et couleur", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    const name = await screen.findByLabelText("Nom de l'espace");
    await user.clear(name);
    await user.type(name, "La famille");
    await user.type(screen.getByLabelText("Description"), "Chez nous");
    await user.click(screen.getByRole("radio", { name: "Tison" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(s.state.bodies.update).toEqual({
        name: "La famille",
        description: "Chez nous",
        tintIndex: 3,
      });
    });
  });

  it("espace perso : seule la couleur", async () => {
    const s = spaceServer();
    renderWithProviders(<App />, { route: `/s/${s.personal.id}/settings` });
    expect(
      await screen.findByRole("radiogroup", { name: "Couleur de l'espace" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nom de l'espace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitter/ })).not.toBeInTheDocument();
  });

  it("un membre quitte l'espace et revient a son espace perso", async () => {
    const s = spaceServer({ myRole: "MEMBER" });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Quitter Famille" }));
    const sheet = screen.getByRole("dialog", { name: "Quitter Famille" });
    await user.click(within(sheet).getByRole("button", { name: "Quitter Famille" }));
    await waitFor(() => {
      expect(s.state.bodies.leave).toEqual({ confirmDeletion: false });
    });
    expect(await screen.findByText("Tu as quitté Famille")).toBeInTheDocument();
  });

  it("l'OWNER doit transferer avant de partir ; il propose a un membre", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    expect(
      await screen.findByText("Pour quitter l'espace, transfère d'abord la propriété à un membre.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Transférer la propriété" }));
    const sheet = screen.getByRole("dialog", { name: "Transférer la propriété" });
    await user.click(await within(sheet).findByRole("option", { name: /lea/ }));
    await user.click(within(sheet).getByRole("button", { name: "Proposer à lea" }));
    await waitFor(() => {
      expect(s.state.bodies.transfer).toEqual({ toUserId: s.lea.user.id });
    });
    expect(await screen.findByText(/lea doit accepter/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Annuler la proposition" }));
    await waitFor(() => {
      expect(s.state.calls).toContain("transfer:cancel");
    });
  });

  it("supprimer : taper le nom pour confirmer (D93)", async () => {
    const s = spaceServer();
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/settings` });
    await user.click(await screen.findByRole("button", { name: "Supprimer Famille" }));
    const sheet = screen.getByRole("dialog", { name: "Supprimer Famille" });
    const confirm = within(sheet).getByRole("button", { name: "Supprimer Famille" });
    expect(confirm).toBeDisabled();
    await user.type(within(sheet).getByLabelText("Pour confirmer, tape Famille"), "Famille");
    await user.click(confirm);
    await waitFor(() => {
      expect(s.state.calls).toContain("delete");
    });
    expect(await screen.findByText("Famille supprimé, restaurable 30 jours")).toBeInTheDocument();
  });

  it("espace en suppression : l'OWNER le restaure", async () => {
    const deleted = buildSpaceDetail({
      name: "TOM",
      tintIndex: 3,
      deletedAt: new Date().toISOString(),
      purgeAfter: new Date(Date.now() + 27 * 86_400_000).toISOString(),
    });
    spaceServer({ extraSpaces: [deleted] });
    let restored = false;
    server.use(
      http.get(`/api/v1/spaces/${deleted.id}`, () =>
        restored
          ? HttpResponse.json({ ...deleted, deletedAt: null, purgeAfter: null })
          : HttpResponse.json(
              { error: { code: "SPACE_001", message: "Espace introuvable." } },
              { status: 404 }
            )
      ),
      http.post(`/api/v1/spaces/${deleted.id}/restore`, () => {
        restored = true;
        return HttpResponse.json({ ...deleted, deletedAt: null, purgeAfter: null });
      })
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${deleted.id}` });
    expect(
      await screen.findByRole("heading", { name: "TOM est en cours de suppression" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Suppression dans 27 jours/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurer TOM" }));
    expect(await screen.findByText("TOM restauré")).toBeInTheDocument();
  });
});
