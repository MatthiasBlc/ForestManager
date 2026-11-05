// E-MEMBRES : membres et roles, actions selon le role (D06, D53), invitations en attente.
import type { Member, SpaceDetail, SpaceRole } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { ActionMenu, type ActionItem } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Avatar, Badge, Skeleton } from "../../ui/display.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { meQuery } from "../session/queries.ts";
import { InviteSheet } from "./invite-sheet.tsx";
import { canIn, membersQuery, spaceInvitationsQuery } from "./queries.ts";
import { ROLE_LABELS } from "./roles.ts";
import { TransferBanner } from "./transfer.tsx";

type MemberAction = "promote" | "demote" | "exclude";

/** Actions possibles sur un membre pour l'acteur courant [D53]. */
function actionsFor(
  space: SpaceDetail,
  target: Member,
  selfId: string
): ActionItem<MemberAction>[] {
  if (target.user.id === selfId || target.role === "OWNER") return [];
  const items: ActionItem<MemberAction>[] = [];
  if (canIn(space, "space.members.role")) {
    items.push(
      target.role === "MEMBER"
        ? { id: "promote", label: "Promouvoir modérateur", icon: "shield" }
        : { id: "demote", label: "Rétrograder membre", icon: "arrow-down" }
    );
  }
  const exclusion =
    target.role === "MODERATOR"
      ? "space.members.exclude.moderator"
      : "space.members.exclude.member";
  if (canIn(space, exclusion))
    items.push({ id: "exclude", label: "Exclure de l'espace", icon: "user-minus", danger: true });
  return items;
}

const sinceFr = (iso: string) =>
  `Membre depuis le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

export function MembersPage({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const members = useQuery(membersQuery(space.id));
  const manage = space.kind === "GROUP" && canIn(space, "space.invites.manage");
  const invitations = useQuery({ ...spaceInvitationsQuery(space.id), enabled: manage });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [excluding, setExcluding] = useState<Member | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["spaces", space.id] });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: SpaceRole }) =>
      api.patch(`/spaces/${space.id}/members/${userId}`, { role }),
    onSuccess: async (_d, { role }) => {
      await refresh();
      toast(role === "MODERATOR" ? "Membre promu modérateur" : "Modérateur rétrogradé", {
        tone: "success",
      });
    },
    onError: (error) => toast(errorMessage(error), { tone: "danger" }),
  });
  const exclude = useMutation({
    mutationFn: (userId: string) => api.delete(`/spaces/${space.id}/members/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      toast("Membre exclu");
      setExcluding(null);
    },
  });
  const cancelInvitation = useMutation({
    mutationFn: (id: string) => api.post(`/spaces/${space.id}/invitations/${id}/cancel`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: spaceInvitationsQuery(space.id).queryKey }),
  });

  const onAction = (member: Member, action: MemberAction) => {
    if (action === "exclude") setExcluding(member);
    else
      changeRole.mutate({
        userId: member.user.id,
        role: action === "promote" ? "MODERATOR" : "MEMBER",
      });
  };

  return (
    <div className="fm-stack mx-auto w-full max-w-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Membres de {space.name}</h1>
          <p className="text-ink-muted">
            {space.memberCount} membre{space.memberCount > 1 ? "s" : ""}
          </p>
        </div>
        {manage ? (
          <Button variant="primary" icon="user-plus" onClick={() => setInviteOpen(true)}>
            Inviter
          </Button>
        ) : null}
      </div>
      <TransferBanner space={space} />
      {members.isPending ? <Skeleton kind="row" /> : null}
      <ul className="fm-stack">
        {members.data?.map((member) => {
          const actions = actionsFor(space, member, me.data?.id ?? "");
          const role = ROLE_LABELS[member.role];
          return (
            <li
              key={member.user.id}
              aria-label={member.user.username}
              className="flex items-center gap-3"
            >
              <Avatar name={member.user.username} src={member.user.avatarUrl} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b>{member.user.username}</b>
                <small className="text-ink-muted">{sinceFr(member.joinedAt)}</small>
              </span>
              <Badge tone={role.tone}>{role.label}</Badge>
              {actions.length > 0 ? (
                <ActionMenu
                  label={`Actions pour ${member.user.username}`}
                  trigger={
                    <IconButton icon="more" label={`Actions pour ${member.user.username}`} />
                  }
                  items={actions}
                  onSelect={(id) => onAction(member, id)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {manage && invitations.data && invitations.data.length > 0 ? (
        <section aria-labelledby="pending-invitations" className="fm-stack">
          <h2 id="pending-invitations" className="font-display text-lg font-bold">
            Invitations en attente
          </h2>
          <ul className="fm-stack">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3">
                <Avatar name={invitation.invitee.username} size={32} />
                <span className="flex-1">
                  <b>{invitation.invitee.username}</b>
                  <br />
                  <small className="text-ink-muted">Invité par {invitation.inviter.username}</small>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Annuler l'invitation de ${invitation.invitee.username}`}
                  onClick={() => cancelInvitation.mutate(invitation.id)}
                >
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {manage ? (
        <InviteSheet space={space} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      ) : null}
      <Sheet
        open={excluding !== null}
        onClose={() => setExcluding(null)}
        title={`Exclure ${excluding?.user.username ?? ""}`}
      >
        <div className="fm-stack">
          <p>
            {excluding?.user.username} n'aura plus accès à {space.name}. Ses recettes restent dans
            l'espace. Il ne pourra revenir que sur invitation directe.
          </p>
          <FormAlert message={exclude.isError ? errorMessage(exclude.error) : undefined} />
          <SheetFooter>
            <Button
              variant="danger"
              block
              disabled={exclude.isPending}
              onClick={() => excluding && exclude.mutate(excluding.user.id)}
            >
              {`Exclure ${excluding?.user.username ?? ""}`}
            </Button>
          </SheetFooter>
        </div>
      </Sheet>
    </div>
  );
}
