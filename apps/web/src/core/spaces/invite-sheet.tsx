// F-INVITER [D07, D94, D150] : par lien (duree, nombre de personnes, revocation)
// ou par nom d'utilisateur exact (reponse neutre).
import { createdInviteLinkSchema, type SpaceDetail } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup, SegmentedControl, Stepper } from "../../ui/controls.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { inviteUrl } from "./invite-code.ts";
import { inviteLinksQuery, spaceInvitationsQuery } from "./queries.ts";

const DURATIONS = [
  { value: "1", label: "1 jour" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
] as const;

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

function LinkMode({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [days, setDays] = useState<"1" | "7" | "30">("7");
  const [uses, setUses] = useState(3);
  const links = useQuery(inviteLinksQuery(space.id));
  const create = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${space.id}/invite-links`,
        { expiresInDays: Number(days), maxUses: uses },
        createdInviteLinkSchema
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inviteLinksQuery(space.id).queryKey }),
  });
  const revoke = useMutation({
    mutationFn: (linkId: string) => api.delete(`/spaces/${space.id}/invite-links/${linkId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteLinksQuery(space.id).queryKey });
      toast("Lien révoqué");
    },
  });
  const url = create.data ? inviteUrl(create.data.code) : null;

  return (
    <div className="fm-stack">
      <RadioGroup label="Durée du lien" options={DURATIONS} value={days} onChange={setDays} />
      <span className="fm-label">Nombre de personnes</span>
      <Stepper label="Nombre de personnes" min={1} max={20} value={uses} onChange={setUses} />
      <FormAlert message={create.isError ? errorMessage(create.error) : undefined} />
      {url ? (
        <div className="fm-stack">
          <Field
            label="Lien d'invitation"
            value={url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <Button
            icon="copy"
            onClick={() => {
              void navigator.clipboard
                .writeText(url)
                .then(() => toast("Lien copié", { tone: "success" }));
            }}
          >
            Copier
          </Button>
          <p className="text-ink-muted">
            Partage ce lien par message. Il permet à {uses} personne{uses > 1 ? "s" : ""} de
            rejoindre {space.name} pendant {days} jour{days === "1" ? "" : "s"}.
          </p>
        </div>
      ) : (
        <Button variant="primary" block disabled={create.isPending} onClick={() => create.mutate()}>
          Créer le lien
        </Button>
      )}
      <section aria-labelledby="active-links" className="fm-stack">
        <h3 id="active-links" className="font-display font-bold">
          Liens actifs
        </h3>
        {links.data?.length === 0 ? <p className="text-ink-muted">Aucun lien actif.</p> : null}
        <ul className="fm-stack">
          {links.data?.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3">
              <span>
                Créé le {dateFr(link.createdAt)}
                <br />
                <small className="text-ink-muted">
                  {link.useCount} utilisation{link.useCount > 1 ? "s" : ""}
                  {link.maxUses ? ` sur ${link.maxUses}` : ""}, expire le {dateFr(link.expiresAt)}
                </small>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(link.id)}
              >
                Révoquer
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UsernameMode({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const invite = useMutation({
    mutationFn: (name: string) => api.post(`/spaces/${space.id}/invitations`, { username: name }),
    onSuccess: () => {
      setUsername("");
      return queryClient.invalidateQueries({ queryKey: spaceInvitationsQuery(space.id).queryKey });
    },
  });
  return (
    <form
      className="fm-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (username.trim()) invite.mutate(username.trim());
      }}
    >
      <Field
        label="Nom d'utilisateur exact"
        autoComplete="off"
        hint="Il n'y a pas d'annuaire : demande-le à la personne."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <FormAlert message={invite.isError ? errorMessage(invite.error) : undefined} />
      {invite.isSuccess ? (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-success-text">
          Si ce compte existe, il recevra l'invitation.
        </p>
      ) : null}
      <Button type="submit" variant="primary" block disabled={!username.trim() || invite.isPending}>
        Inviter
      </Button>
    </form>
  );
}

export function InviteSheet({
  space,
  open,
  onClose,
}: {
  space: SpaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"link" | "username">("link");
  return (
    <Sheet open={open} onClose={onClose} title={`Inviter dans ${space.name}`}>
      <div className="fm-stack">
        <SegmentedControl
          label="Mode d'invitation"
          value={mode}
          onChange={setMode}
          options={[
            { value: "link", label: "Par lien" },
            { value: "username", label: "Par nom d'utilisateur" },
          ]}
        />
        {mode === "link" ? <LinkMode space={space} /> : <UsernameMode space={space} />}
      </div>
    </Sheet>
  );
}
