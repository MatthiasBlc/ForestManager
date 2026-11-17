// Requetes des espaces : membres, liens, invitations envoyees, transfert.
import {
  invitationSchema,
  inviteLinkSchema,
  listSchema,
  memberSchema,
  ownershipTransferSchema,
  type SpaceDetail,
} from "@fm/shared";
import { can, type CorePermissionKey } from "@fm/shared";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "../../lib/api.ts";

export function membersQuery(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", spaceId, "members"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/members`, listSchema(memberSchema))).data,
  });
}

export function inviteLinksQuery(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", spaceId, "invite-links"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/invite-links`, listSchema(inviteLinkSchema))).data,
  });
}

export function spaceInvitationsQuery(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", spaceId, "invitations"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/invitations`, listSchema(invitationSchema))).data,
  });
}

export function transferQuery(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", spaceId, "transfer"],
    queryFn: async () =>
      (
        await api.get(
          `/spaces/${spaceId}/transfer`,
          z.object({ transfer: ownershipTransferSchema.nullable() })
        )
      ).transfer,
  });
}

/** Droit du membre courant dans l'espace (matrice partagee). */
export function canIn(space: SpaceDetail, key: CorePermissionKey): boolean {
  return can({ authenticated: true, space: { kind: space.kind, role: space.myRole } }, key);
}

/**
 * Apres une arrivee dans un espace (lien ou invitation) : la liste des espaces,
 * l'accueil (recettes du nouvel espace, D7) et les notifications (avis
 * d'invitation lu, D6) ont change.
 */
export async function refreshAfterJoin(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["spaces"] }),
    client.invalidateQueries({ queryKey: ["me"] }),
    client.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}
