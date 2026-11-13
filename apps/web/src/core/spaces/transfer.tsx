// Transfert de propriete [D92] : proposition (F-TRANSFERER) et bandeau de la
// proposition en attente (annuler pour l'OWNER, accepter ou refuser pour le destinataire).
import type { SpaceDetail } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { OptionList } from "../../ui/option-list.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { meQuery } from "../session/queries.ts";
import { membersQuery, transferQuery } from "./queries.ts";

export function TransferSheet({
  space,
  open,
  onClose,
}: {
  space: SpaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const members = useQuery({ ...membersQuery(space.id), enabled: open });
  const [toUserId, setToUserId] = useState<string | null>(null);
  const candidates = (members.data ?? []).filter((m) => m.user.id !== me.data?.id);
  const chosen = candidates.find((m) => m.user.id === toUserId);
  const propose = useMutation({
    mutationFn: (id: string) => api.post(`/spaces/${space.id}/transfers`, { toUserId: id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transferQuery(space.id).queryKey });
      toast("Proposition envoyée", { tone: "success" });
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Transférer la propriété">
      <div className="fm-stack">
        <p>Choisis le membre qui deviendra propriétaire de {space.name}.</p>
        <OptionList
          label="Nouveau propriétaire"
          value={toUserId}
          onChange={setToUserId}
          options={candidates.map((m) => ({
            value: m.user.id,
            label: m.user.username,
            avatar: m.user.username,
          }))}
        />
        {chosen ? (
          <p className="text-ink-muted">
            {chosen.user.username} recevra une demande à accepter. Une fois acceptée, tu deviendras
            modérateur de {space.name}.
          </p>
        ) : null}
        <FormAlert message={propose.isError ? errorMessage(propose.error) : undefined} />
        <SheetFooter>
          <Button
            variant="primary"
            block
            disabled={!chosen || propose.isPending}
            onClick={() => chosen && propose.mutate(chosen.user.id)}
          >
            {chosen ? `Proposer à ${chosen.user.username}` : "Proposer"}
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

export function TransferBanner({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const transfer = useQuery(transferQuery(space.id));
  const act = useMutation({
    mutationFn: (action: "accept" | "decline" | "cancel") =>
      api.post(`/spaces/${space.id}/transfers/${transfer.data?.id ?? ""}/${action}`),
    onSuccess: async (_data, action) => {
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      toast(
        action === "accept"
          ? `Tu es propriétaire de ${space.name}`
          : action === "decline"
            ? "Proposition refusée"
            : "Proposition annulée"
      );
    },
  });
  const t = transfer.data;
  if (!t || !me.data) return null;
  const forMe = t.toUser.id === me.data.id;
  const fromMe = t.fromUser.id === me.data.id;
  if (!forMe && !fromMe) return null;
  return (
    <div role="status" className="fm-stack rounded-lg border border-line bg-surface-raised p-4">
      {forMe ? (
        <>
          <p>
            {t.fromUser.username} te propose de devenir propriétaire de {space.name}.
          </p>
          <div className="fm-row">
            <Button variant="primary" disabled={act.isPending} onClick={() => act.mutate("accept")}>
              Accepter
            </Button>
            <Button disabled={act.isPending} onClick={() => act.mutate("decline")}>
              Refuser
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            Proposition de transfert envoyée : {t.toUser.username} doit accepter pour devenir
            propriétaire.
          </p>
          <div>
            <Button disabled={act.isPending} onClick={() => act.mutate("cancel")}>
              Annuler la proposition
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
