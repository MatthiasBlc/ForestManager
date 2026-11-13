import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import {
  buildInvitation,
  buildMe,
  buildPersonalSpace,
  buildSpaceDetail,
  buildTransfer,
} from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

describe("accueil (E-ACCUEIL, F-INVITATION)", () => {
  it("salue ; la section en attente n'apparait que s'il y a quelque chose", async () => {
    const me = buildMe({ username: "matthias" });
    mockSession({ me });
    renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    expect(await screen.findByRole("heading", { name: /matthias/ })).toBeInTheDocument();
    await screen.findByRole("button", { name: "Personnaliser l'accueil" });
    expect(screen.queryByRole("heading", { name: "En attente" })).toBeNull();
  });

  it("accepte une invitation recue et ouvre l'espace ; refuse une autre", async () => {
    const me = buildMe({ username: "matthias" });
    const famille = buildSpaceDetail({ name: "Famille", tintIndex: 3 });
    const invitation = buildInvitation({
      space: { id: famille.id, name: "Famille", tintIndex: 3, avatarUrl: null },
    });
    const other = buildInvitation({
      space: { id: famille.id, name: "Amis", tintIndex: 4, avatarUrl: null },
    });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    const calls: string[] = [];
    server.use(
      http.get("/api/v1/me/invitations", () => HttpResponse.json({ data: [invitation, other] })),
      http.post("/api/v1/me/invitations/:id/:action", ({ params }) => {
        calls.push(`${String(params.action)}:${String(params.id)}`);
        return params.action === "accept"
          ? HttpResponse.json(famille)
          : new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    const amis = await screen.findByRole("listitem", { name: "Invitation dans Amis" });
    await user.click(within(amis).getByRole("button", { name: "Refuser" }));
    const card = screen.getByRole("listitem", { name: "Invitation dans Famille" });
    expect(within(card).getByText(/lea t'invite/)).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Rejoindre Famille" }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-space", "3");
    });
    expect(calls).toEqual([`decline:${other.id}`, `accept:${invitation.id}`]);
  });

  it("propose d'accepter un transfert de propriete recu", async () => {
    const me = buildMe({ username: "matthias" });
    const famille = buildSpaceDetail({ name: "Famille" });
    const transfer = buildTransfer({
      spaceId: famille.id,
      toUser: { id: me.id, username: "matthias", avatarUrl: null },
    });
    mockSession({ me, spaces: [buildPersonalSpace(me), famille] });
    let accepted = false;
    server.use(
      http.get("/api/v1/me/transfers", () =>
        HttpResponse.json({ data: accepted ? [] : [transfer] })
      ),
      http.post(`/api/v1/spaces/${famille.id}/transfers/${transfer.id}/accept`, () => {
        accepted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: `/s/${me.personalSpaceId}/home` });
    const item = await screen.findByRole("listitem", { name: "Transfert de Famille" });
    await user.click(within(item).getByRole("button", { name: "Accepter" }));
    await waitFor(() => {
      expect(accepted).toBe(true);
    });
  });
});
