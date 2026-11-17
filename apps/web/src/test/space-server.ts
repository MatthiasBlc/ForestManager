// Faux serveur d'un espace groupe (MSW) : membres, liens, invitations, transfert.
// Garde l'etat et les corps recus pour les assertions.
import {
  errorBody,
  type InviteLink,
  type Me,
  type Member,
  type OwnershipTransfer,
  type SpaceDetail,
  type SpaceRole,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import {
  buildInvitation,
  buildMe,
  buildMember,
  buildPersonalSpace,
  buildSpaceDetail,
  buildTransfer,
  uuid,
} from "./fixtures.ts";
import { server } from "./server.ts";
import { mockSession } from "./session.ts";

export function spaceServer({
  myRole = "OWNER",
  extraSpaces = [],
}: { myRole?: SpaceRole; extraSpaces?: SpaceDetail[] } = {}) {
  const me: Me = buildMe({ username: "matthias" });
  const space = buildSpaceDetail({ name: "Famille", tintIndex: 1, myRole, memberCount: 3 });
  const lea = buildMember({
    user: { id: uuid(), username: "lea", avatarUrl: null },
    role: "MODERATOR",
  });
  const sam = buildMember({
    user: { id: uuid(), username: "sam", avatarUrl: null },
    role: "MEMBER",
  });
  const self = buildMember({
    user: { id: me.id, username: "matthias", avatarUrl: null },
    role: myRole,
  });
  const state = {
    me,
    space,
    members: [self, lea, sam] as Member[],
    links: [] as InviteLink[],
    invitations: [buildInvitation({ invitee: { id: uuid(), username: "hugo", avatarUrl: null } })],
    transfer: null as OwnershipTransfer | null,
    bodies: {} as Record<string, unknown>,
    calls: [] as string[],
  };
  const personal = buildPersonalSpace(me);
  mockSession({ me, spaces: [personal, space, ...extraSpaces] });
  const base = `/api/v1/spaces/${space.id}`;
  const record = (name: string, body?: unknown) => {
    state.calls.push(name);
    if (body !== undefined) state.bodies[name] = body;
  };
  server.use(
    http.get(`${base}/members`, () => HttpResponse.json({ data: state.members })),
    http.patch(`${base}/members/:userId`, async ({ params, request }) => {
      const body = (await request.json()) as { role: SpaceRole };
      record("role", { userId: params.userId, ...body });
      state.members = state.members.map((m) =>
        m.user.id === params.userId ? { ...m, role: body.role } : m
      );
      return HttpResponse.json({ data: state.members });
    }),
    http.delete(`${base}/members/:userId`, ({ params }) => {
      record("exclude", params.userId);
      state.members = state.members.filter((m) => m.user.id !== params.userId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${base}/invite-links`, () => HttpResponse.json({ data: state.links })),
    http.post(`${base}/invite-links`, async ({ request }) => {
      const body = (await request.json()) as { expiresInDays: number; maxUses: number | null };
      record("createLink", body);
      const link: InviteLink = {
        id: uuid(),
        createdBy: self.user,
        expiresAt: new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString(),
        maxUses: body.maxUses,
        useCount: 0,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      };
      state.links = [link, ...state.links];
      return HttpResponse.json({ ...link, code: "k7Q2pX9aAbCdEfGhIjKlMn" }, { status: 201 });
    }),
    http.delete(`${base}/invite-links/:linkId`, ({ params }) => {
      record("revoke", params.linkId);
      state.links = state.links.filter((l) => l.id !== params.linkId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${base}/invitations`, () => HttpResponse.json({ data: state.invitations })),
    http.post(`${base}/invitations`, async ({ request }) => {
      record("invite", await request.json());
      return new HttpResponse(null, { status: 202 });
    }),
    http.post(`${base}/invitations/:id/cancel`, ({ params }) => {
      record("cancelInvitation", params.id);
      state.invitations = state.invitations.filter((i) => i.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${base}/transfer`, () => HttpResponse.json({ transfer: state.transfer })),
    http.post(`${base}/transfers`, async ({ request }) => {
      const body = (await request.json()) as { toUserId: string };
      record("transfer", body);
      const to = state.members.find((m) => m.user.id === body.toUserId)!;
      state.transfer = buildTransfer({ spaceId: space.id, fromUser: self.user, toUser: to.user });
      return HttpResponse.json(state.transfer, { status: 201 });
    }),
    http.post(`${base}/transfers/:id/:action`, ({ params }) => {
      record(`transfer:${String(params.action)}`);
      state.transfer = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(base, async ({ request }) => {
      const body = (await request.json()) as Partial<SpaceDetail>;
      record("update", body);
      Object.assign(state.space, body);
      return HttpResponse.json(state.space);
    }),
    http.post(`${base}/leave`, async ({ request }) => {
      const body = (await request.json()) as { confirmDeletion: boolean };
      record("leave", body);
      if (myRole === "OWNER" && state.members.length > 1) {
        return HttpResponse.json(errorBody("SPACE_004"), { status: 409 });
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(base, () => {
      record("delete");
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { ...state, state, personal, lea, sam };
}
