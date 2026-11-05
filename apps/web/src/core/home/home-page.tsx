// E-ACCUEIL (C2) : salutation, invitations et transferts recus. Les widgets
// (prochains repas, recettes recentes) arrivent avec leurs modules et en C6.
import {
  invitationSchema,
  listSchema,
  ownershipTransferSchema,
  spaceDetailSchema,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { Button } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { meQuery, spacesQuery } from "../session/queries.ts";

const invitationsQuery = {
  queryKey: ["me", "invitations"],
  queryFn: async () => (await api.get("/me/invitations", listSchema(invitationSchema))).data,
};
const transfersQuery = {
  queryKey: ["me", "transfers"],
  queryFn: async () => (await api.get("/me/transfers", listSchema(ownershipTransferSchema))).data,
};

function greeting(): string {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
}

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const spaces = useQuery(spacesQuery);
  const invitations = useQuery(invitationsQuery);
  const transfers = useQuery(transfersQuery);
  const onError = (error: Error) => toast(errorMessage(error), { tone: "danger" });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept
        ? api.post(`/me/invitations/${id}/accept`, undefined, spaceDetailSchema)
        : api.post(`/me/invitations/${id}/decline`),
    onSuccess: async (space) => {
      await queryClient.invalidateQueries({ queryKey: ["me", "invitations"] });
      if (space) {
        await queryClient.invalidateQueries({ queryKey: ["spaces"] });
        toast(`Bienvenue dans ${space.name}`, { tone: "success" });
        void navigate(`/s/${space.id}`);
      }
    },
    onError,
  });
  const answerTransfer = useMutation({
    mutationFn: ({
      spaceId,
      id,
      action,
    }: {
      spaceId: string;
      id: string;
      action: "accept" | "decline";
    }) => api.post(`/spaces/${spaceId}/transfers/${id}/${action}`),
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: ["me", "transfers"] })
        .then(() => queryClient.invalidateQueries({ queryKey: ["spaces"] })),
    onError,
  });

  const nameOf = (spaceId: string) =>
    spaces.data?.find((s) => s.id === spaceId)?.name ?? "l'espace";
  const empty = invitations.data?.length === 0 && transfers.data?.length === 0;

  return (
    <div className="fm-stack mx-auto w-full max-w-2xl p-4">
      <h1 className="font-display text-2xl font-bold">
        {greeting()}, {me.data?.username}
      </h1>
      <section aria-labelledby="home-pending" className="fm-stack">
        <h2 id="home-pending" className="font-display text-lg font-bold">
          En attente
        </h2>
        {invitations.isPending || transfers.isPending ? <Skeleton kind="row" count={2} /> : null}
        {empty ? <p className="text-ink-muted">Rien en attente pour l'instant.</p> : null}
        <ul className="fm-stack">
          {invitations.data?.map((invitation) => (
            <li
              key={invitation.id}
              aria-label={`Invitation dans ${invitation.space.name}`}
              className="fm-stack rounded-lg border border-line bg-surface-raised p-4"
            >
              <div className="flex items-center gap-3">
                <SpaceIcon
                  space={{
                    id: invitation.space.id,
                    name: invitation.space.name,
                    tint: invitation.space.tintIndex,
                    image: invitation.space.avatarUrl,
                  }}
                />
                <p>
                  {invitation.inviter.username} t'invite à rejoindre <b>{invitation.space.name}</b>.
                </p>
              </div>
              <div className="fm-row">
                <Button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: invitation.id, accept: false })}
                >
                  Refuser
                </Button>
                <Button
                  variant="primary"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: invitation.id, accept: true })}
                >
                  {`Rejoindre ${invitation.space.name}`}
                </Button>
              </div>
            </li>
          ))}
          {transfers.data?.map((transfer) => (
            <li
              key={transfer.id}
              aria-label={`Transfert de ${nameOf(transfer.spaceId)}`}
              className="fm-stack rounded-lg border border-line bg-surface-raised p-4"
            >
              <p>
                {transfer.fromUser.username} te propose de devenir propriétaire de{" "}
                <b>{nameOf(transfer.spaceId)}</b>.
              </p>
              <div className="fm-row">
                <Button
                  disabled={answerTransfer.isPending}
                  onClick={() =>
                    answerTransfer.mutate({
                      spaceId: transfer.spaceId,
                      id: transfer.id,
                      action: "decline",
                    })
                  }
                >
                  Refuser
                </Button>
                <Button
                  variant="primary"
                  disabled={answerTransfer.isPending}
                  onClick={() =>
                    answerTransfer.mutate({
                      spaceId: transfer.spaceId,
                      id: transfer.id,
                      action: "accept",
                    })
                  }
                >
                  Accepter
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
