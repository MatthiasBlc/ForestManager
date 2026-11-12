// Partage des recettes [D03, D26, D81, D101] : F-PARTAGER (cases par espace),
// F-PARTAGER-Demande (demande a l'auteur), demandes recues (F-DEMANDE-PARTAGE),
// retrait d'un espace de partage (F-REC-9).
import {
  shareRequestResultSchema,
  type Recipe,
  type ShareRequest,
  type SpaceSummary,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spacesQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { SegmentedControl, Switch } from "../../ui/controls.tsx";
import { Avatar, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { joinNames } from "./format.ts";
import { recipeQuery, recipesKey, shareRequestsQuery, sharingQuery } from "./queries.ts";

function SpaceRow({ space, children }: { space: SpaceSummary; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={space.name} tint={space.tintIndex} size={32} />
      {children}
    </div>
  );
}

/** F-PARTAGER : l'auteur (ou qui tranche pour lui) coche ses espaces. */
function DirectShare({
  spaceId,
  recipe,
  onClose,
}: {
  spaceId: string;
  recipe: Recipe;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const sharing = useQuery(sharingQuery(spaceId, recipe.id));
  const spaces = useQuery(spacesQuery);
  const [checked, setChecked] = useState<Set<string> | null>(null);
  const shared = new Set(
    (sharing.data?.spaces ?? []).filter((s) => s.status === "SHARED").map((s) => s.spaceId)
  );
  const current = checked ?? shared;
  const pending = new Set(
    (sharing.data?.spaces ?? []).filter((s) => s.status === "PENDING").map((s) => s.spaceId)
  );
  const home = sharing.data?.homeSpace.id ?? recipe.homeSpaceId;
  const all = (spaces.data ?? []).filter((s) => !s.deletedAt);
  const origin = all.find((s) => s.id === home);
  // L'espace perso ne sert pas de cible ("Mes recettes" montre deja tout, D82).
  const targets = all.filter((s) => s.id !== home && s.kind === "GROUP");
  const save = useMutation({
    mutationFn: () =>
      api.put(`/spaces/${spaceId}/recipes/${recipe.id}/shares`, {
        // Un partage existant hors des cibles affichees (espace perso) est garde.
        spaceIds: [...current].filter((id) => id !== home),
      }),
    onSuccess: async () => {
      const added = targets.filter((s) => current.has(s.id) && !shared.has(s.id));
      await queryClient.invalidateQueries({ queryKey: recipeQuery(spaceId, recipe.id).queryKey });
      toast(
        added.length > 0
          ? `Partagée dans ${joinNames(added.map((s) => s.name))}`
          : "Partage mis à jour",
        { tone: "success" }
      );
      onClose();
    },
  });

  if (!sharing.data || !spaces.data) return <Skeleton label="Chargement du partage…" />;
  const withIt = sharing.data.withIt;
  return (
    <div className="fm-stack">
      <b>{recipe.title}</b>
      {origin ? (
        <SpaceRow space={origin}>
          <span className="flex flex-1 flex-col">
            <span>{origin.name}</span>
            <small className="text-ink-muted">Espace d'origine</small>
          </span>
        </SpaceRow>
      ) : null}
      {targets.map((space) => (
        <SpaceRow key={space.id} space={space}>
          <span className="flex-1">
            <Switch
              label={space.name}
              checked={current.has(space.id)}
              onChange={(on) => {
                const next = new Set(current);
                if (on) next.add(space.id);
                else next.delete(space.id);
                setChecked(next);
              }}
            />
            {pending.has(space.id) && !current.has(space.id) ? (
              <small className="block text-ink-muted">Demande de partage en attente</small>
            ) : null}
          </span>
        </SpaceRow>
      ))}
      {targets.length === 0 ? (
        <p className="text-ink-muted">Tu n'as pas d'autre espace où la partager.</p>
      ) : null}
      {withIt.length > 0 ? (
        <section className="fm-stack" aria-labelledby="share-with-it">
          <h3 id="share-with-it" className="m-0 text-sm font-semibold">
            Partagée avec elle
          </h3>
          <ul className="m-0 list-none p-0">
            {withIt.map((sub) => (
              <li key={sub.id}>
                {sub.title}
                {sub.included ? null : <small className="text-ink-muted"> · non disponible</small>}
              </li>
            ))}
          </ul>
          <small className="text-ink-muted">
            Les recettes liées de l'auteur sont partagées dans les mêmes espaces pour que tout le
            monde voie les quantités.
          </small>
        </section>
      ) : null}
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <SheetFooter>
        <Button variant="primary" block disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

/** F-PARTAGER-Demande : demander a l'auteur de partager vers un autre de ses espaces. */
function RequestShare({
  spaceId,
  recipe,
  onClose,
}: {
  spaceId: string;
  recipe: Recipe;
  onClose: () => void;
}) {
  const toast = useToast();
  const sharing = useQuery(sharingQuery(spaceId, recipe.id));
  const spaces = useQuery(spacesQuery);
  const [target, setTarget] = useState<string>();
  const [message, setMessage] = useState("");
  const author = recipe.author.username;
  const taken = new Set((sharing.data?.spaces ?? []).map((s) => s.spaceId));
  const targets = (spaces.data ?? []).filter(
    (s) =>
      s.kind === "GROUP" &&
      !s.deletedAt &&
      s.id !== recipe.homeSpaceId &&
      s.id !== spaceId &&
      !taken.has(s.id)
  );
  const chosen = targets.find((s) => s.id === target) ?? targets[0];
  const send = useMutation({
    mutationFn: (to: SpaceSummary) =>
      api.post(
        `/spaces/${spaceId}/recipes/${recipe.id}/share-requests`,
        { targetSpaceId: to.id, ...(message.trim() ? { message: message.trim() } : {}) },
        shareRequestResultSchema
      ),
    onSuccess: (result, to) => {
      toast(
        result.status === "SHARED" ? `Partagée dans ${to.name}` : `Demande envoyée à ${author}`,
        {
          tone: "success",
        }
      );
      onClose();
    },
  });

  if (!sharing.data || !spaces.data) return <Skeleton label="Chargement du partage…" />;
  return (
    <div className="fm-stack">
      <div className="flex items-center gap-3">
        <Avatar name={author} size={36} />
        <span className="flex flex-col">
          <b>{recipe.title}</b>
          <small className="text-ink-muted">
            par {author} · {recipe.homeSpace.name}
          </small>
        </span>
      </div>
      {chosen ? (
        <>
          <SegmentedControl
            label="Espace cible"
            options={targets.map((s) => ({ value: s.id, label: s.name }))}
            value={chosen.id}
            onChange={setTarget}
          />
          <Field
            label={`Un mot pour ${author} (facultatif)`}
            multiline
            maxLength={280}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
            }}
          />
          <p className="m-0">
            Cette recette est celle de {author}. Cette personne reçoit ta demande et décide.
          </p>
          <small className="text-ink-muted">
            Si {author} a autorisé les membres de {sharing.data.homeSpace.name} à partager ses
            recettes, le partage est immédiat.
          </small>
          <FormAlert message={send.isError ? errorMessage(send.error) : undefined} />
          <SheetFooter>
            <Button
              variant="primary"
              icon="share"
              block
              disabled={send.isPending}
              onClick={() => send.mutate(chosen)}
            >
              Envoyer la demande
            </Button>
          </SheetFooter>
        </>
      ) : (
        <p className="text-ink-muted">
          Elle est déjà partagée ou demandée dans tous tes autres espaces.
        </p>
      )}
    </div>
  );
}

export function ShareSheet({
  spaceId,
  recipe,
  open,
  onClose,
}: {
  spaceId: string;
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
}) {
  const direct = recipe.can.share;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={direct ? "Partager dans tes espaces" : "Partager dans un autre espace"}
    >
      {open ? (
        direct ? (
          <DirectShare spaceId={spaceId} recipe={recipe} onClose={onClose} />
        ) : (
          <RequestShare spaceId={spaceId} recipe={recipe} onClose={onClose} />
        )
      ) : null}
    </Sheet>
  );
}

/** F-REC-9 : retirer la recette de l'espace de partage courant. */
export function RemoveFromSpaceSheet({
  spaceId,
  spaceName,
  recipe,
  open,
  onClose,
  onDone,
}: {
  spaceId: string;
  spaceName: string;
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
  /** Apres le retrait : la recette n'est plus visible ici. */
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: () => api.delete(`/spaces/${spaceId}/recipes/${recipe.id}/share`),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: recipeQuery(spaceId, recipe.id).queryKey });
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      toast(`Recette retirée de ${spaceName}`, { tone: "success" });
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Retirer « ${recipe.title} » de ${spaceName} ?`}>
      <p>
        Les membres de {spaceName} ne la verront plus. Elle reste dans {recipe.homeSpace.name}, chez{" "}
        {recipe.author.username}.
      </p>
      <FormAlert message={remove.isError ? errorMessage(remove.error) : undefined} />
      <SheetFooter>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Retirer
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

/** F-DEMANDE-PARTAGE : accepter (avec la confiance de l'auteur) ou refuser. */
function ShareRequestSheet({
  spaceId,
  request,
  onClose,
}: {
  spaceId: string;
  request: ShareRequest | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [trust, setTrust] = useState<boolean>();
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve
        ? api.post(
            `/spaces/${spaceId}/recipes/share-requests/${id}/approve`,
            trust !== undefined ? { trustMembers: trust } : {}
          )
        : api.post(`/spaces/${spaceId}/recipes/share-requests/${id}/reject`),
    onSuccess: async (_, { approve }) => {
      await queryClient.invalidateQueries({ queryKey: shareRequestsQuery(spaceId).queryKey });
      toast(approve ? `Partagée dans ${request?.targetSpace.name ?? ""}` : "Demande refusée", {
        tone: approve ? "success" : "neutral",
      });
      onClose();
    },
  });
  const req = request;
  return (
    <Sheet open={req !== undefined} onClose={onClose} title="Demande de partage">
      {req ? (
        <div className="fm-stack">
          <div className="flex items-start gap-3">
            <Avatar name={req.requester.username} size={36} />
            <p className="m-0 flex-1">
              {req.requester.username} voudrait partager <b>{req.recipe.title}</b> (
              {req.homeSpace.name}) dans <b>{req.targetSpace.name}</b>,{" "}
              {req.targetSpace.memberCount > 1
                ? `ses ${String(req.targetSpace.memberCount)} membres la verront.`
                : "son seul membre la verra."}
            </p>
          </div>
          {req.message ? <blockquote className="m-0 italic">« {req.message} »</blockquote> : null}
          {req.trust !== null ? (
            <Switch
              label={`Les membres de ${req.sourceSpace.name} peuvent partager mes recettes sans me demander`}
              checked={trust ?? req.trust}
              onChange={setTrust}
            />
          ) : null}
          <small className="text-ink-muted">
            La recette pourra être retirée de {req.targetSpace.name} quand tu veux.
          </small>
          <FormAlert message={decide.isError ? errorMessage(decide.error) : undefined} />
          <SheetFooter>
            <Button
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: req.id, approve: false })}
            >
              Refuser
            </Button>
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: req.id, approve: true })}
            >
              Accepter
            </Button>
          </SheetFooter>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Bandeau des demandes a trancher (D165), sur la liste ou "Mes recettes". */
export function ShareRequestsBanner({ spaceId }: { spaceId: string }) {
  const requests = useQuery(shareRequestsQuery(spaceId));
  const [openId, setOpenId] = useState<string>();
  const list = requests.data ?? [];
  const open = list.find((r) => r.id === openId);
  if (list.length === 0 && !open) return null;
  const first = list[0];
  return (
    <>
      {first ? (
        <button
          type="button"
          className="fm-option"
          onClick={() => {
            setOpenId(first.id);
          }}
        >
          <span className="fm-option-icon">
            <Icon name="share" />
          </span>
          <span className="fm-option-text">
            <b>
              {list.length} demande{list.length > 1 ? "s" : ""} de partage
            </b>
            <small>
              {first.requester.username} voudrait partager {first.recipe.title} dans{" "}
              {first.targetSpace.name}
            </small>
          </span>
          <Icon name="chevron-right" className="fm-option-go" />
        </button>
      ) : null}
      <ShareRequestSheet
        spaceId={spaceId}
        request={open}
        onClose={() => {
          setOpenId(undefined);
        }}
      />
    </>
  );
}
