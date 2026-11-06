// E-SUGGESTION : ce qu'accepter changerait a la version actuelle, conflits
// signales ; accepter (revision SUGGESTION), refuser avec un mot
// (E-SUGGESTION-Refus) ; cote suggereur : retirer, ou apres un refus
// (E-SUGGESTION-Refusee) en faire son adaptation [D04, D140, D166].
import { diffContents, recipeSchema, type DiffEntry, type Suggestion } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { Button } from "../../ui/button.tsx";
import { Avatar, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { ConvertSuggestionSheet, DiffTable } from "./adaptation.tsx";
import {
  recipeFailure,
  recipeQuery,
  recipesKey,
  suggestionQuery,
  suggestionsToDecideQuery,
  unitsQuery,
} from "./queries.ts";
import { RecipeUnavailable } from "./recipe-page.tsx";

const STATUS_TEXT: Record<Suggestion["status"], string> = {
  PENDING: "",
  ACCEPTED: "Suggestion acceptée : la recette a une nouvelle révision.",
  REJECTED: "Suggestion refusée.",
  WITHDRAWN: "Suggestion retirée par son auteur.",
  CONVERTED: "Suggestion refusée, devenue une adaptation.",
  CANCELLED: "Suggestion annulée : son auteur a quitté l'espace.",
};

/** Une difference est en conflit si sa partie l'est (champ, bloc, ou tous les blocs). */
function inConflict(conflicts: readonly string[]) {
  return (entry: DiffEntry) =>
    entry.kind === "field"
      ? conflicts.includes(entry.field)
      : conflicts.includes("blocks") || conflicts.includes(`block:${String(entry.block)}`);
}

function RejectSheet({
  suggestion,
  open,
  onClose,
  onDone,
}: {
  suggestion: Suggestion;
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const proposer = suggestion.proposer.username;
  return (
    <Sheet open={open} onClose={onClose} title="Refuser la suggestion">
      <div className="fm-stack">
        <span className="flex flex-col">
          <b>{suggestion.recipe.title}</b>
          <small className="text-ink-muted">
            Suggestion de {proposer} · révision {suggestion.baseRevision}
          </small>
        </span>
        <Field
          label={`Un mot pour ${proposer} (facultatif)`}
          multiline
          maxLength={280}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
        />
        <p className="m-0 text-ink-muted">
          Ta recette ne change pas. {proposer} peut garder ses changements en faisant sa propre
          adaptation.
        </p>
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            onClick={() => {
              onDone(message.trim());
            }}
          >
            Refuser
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

export function SuggestionPage() {
  const { spaceId = "", recipeId = "", suggestionId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery(suggestionQuery(spaceId, recipeId, suggestionId));
  const units = useQuery(unitsQuery);
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const [sheet, setSheet] = useState<"reject" | "convert" | null>(null);
  const base = `/spaces/${spaceId}/recipes/${recipeId}/suggestions/${suggestionId}`;
  const back = () => {
    void navigate(`/s/${spaceId}/recipes/${recipeId}`);
  };
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: recipeQuery(spaceId, recipeId).queryKey });
    await queryClient.invalidateQueries({ queryKey: suggestionsToDecideQuery(spaceId).queryKey });
    await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
  };
  const act = useMutation({
    mutationFn: async (action: { kind: "accept" | "reject" | "withdraw"; message?: string }) => {
      if (action.kind === "accept") {
        const revision = query.data?.currentRevision ?? 0;
        return api.post(`${base}/accept`, { revision }, recipeSchema);
      }
      if (action.kind === "reject") {
        await api.post(`${base}/reject`, action.message ? { message: action.message } : {});
      } else {
        await api.post(`${base}/withdraw`);
      }
      return null;
    },
    onSuccess: async (recipe, action) => {
      setSheet(null);
      await refresh();
      if (recipe)
        toast(`Suggestion acceptée : révision ${String(recipe.currentRevision)}`, {
          tone: "success",
        });
      else toast(action.kind === "reject" ? "Suggestion refusée" : "Suggestion retirée");
      back();
    },
  });

  const chrome = <PageChrome top={<TopBar title="Suggestion" onBack={back} />} />;
  const failure = recipeFailure(query);
  if (failure) {
    return (
      <RecipeUnavailable spaceId={spaceId} failure={failure} onRetry={() => void query.refetch()} />
    );
  }
  if (!query.data || !units.data) {
    return (
      <>
        {chrome}
        <Skeleton />
      </>
    );
  }
  const s = query.data;
  const changes = diffContents(s.current, s.result);
  const upToDate = s.baseRevision === s.currentRevision;
  const refused = s.status === "REJECTED" && s.can.convert;
  return (
    <>
      {chrome}
      <article className="fm-stack mx-auto w-full max-w-3xl p-4" aria-labelledby="suggestion-title">
        <div className="flex flex-col gap-1">
          <h1 id="suggestion-title" className="m-0 font-display text-[26px] leading-8 font-bold">
            {s.recipe.title}
          </h1>
          <span className="text-sm text-ink-muted">
            {upToDate
              ? `Basée sur la révision ${String(s.baseRevision)}, la version actuelle`
              : `Basée sur la révision ${String(s.baseRevision)} (actuelle : ${String(s.currentRevision)})`}
          </span>
        </div>

        {refused && s.decidedBy ? (
          <section className="fm-stack" aria-label="Suggestion refusée">
            <p className="m-0">
              {s.decidedBy.username} a refusé ta suggestion sur {s.recipe.title}.
            </p>
            {s.decisionMessage ? (
              <blockquote className="m-0 italic">« {s.decisionMessage} »</blockquote>
            ) : null}
            <p className="m-0 text-ink-muted">
              Tes changements ne sont pas perdus : fais-en ton adaptation dans un de tes espaces,
              liée à l'original.
            </p>
            <div>
              <Button variant="primary" onClick={() => setSheet("convert")}>
                En faire mon adaptation
              </Button>
            </div>
          </section>
        ) : s.status !== "PENDING" ? (
          <p className="m-0 text-ink-muted" role="status">
            {STATUS_TEXT[s.status]}
          </p>
        ) : null}

        <div className="flex items-start gap-3">
          <Avatar name={s.proposer.username} size={40} />
          <div className="flex flex-1 flex-col gap-1">
            <b>{s.proposer.username}</b>
            {s.message ? <blockquote className="m-0 italic">« {s.message} »</blockquote> : null}
          </div>
        </div>

        {changes.length > 0 ? (
          <DiffTable
            caption="Changements proposés"
            columns={["Actuel", "Avec la suggestion"]}
            entries={changes}
            units={units.data}
            conflicts={inConflict(s.conflicts)}
          />
        ) : (
          <p className="m-0 text-ink-muted">
            Rien ne changerait : la recette contient déjà ces changements.
          </p>
        )}
        {s.conflicts.length > 0 ? (
          <small className="text-ink-muted">
            « Changé des deux côtés » : la recette a aussi changé là depuis la suggestion. Accepter
            garde la version de la suggestion.
          </small>
        ) : null}

        <FormAlert message={act.isError ? errorMessage(act.error) : undefined} />
        {s.can.decide ? (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={act.isPending} onClick={() => setSheet("reject")}>
              Refuser
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={act.isPending}
              onClick={() => act.mutate({ kind: "accept" })}
            >
              Accepter la suggestion
            </Button>
          </div>
        ) : s.status === "PENDING" ? (
          <>
            <p className="m-0 text-ink-muted">
              En attente de la décision de {recipe.data?.author.username ?? "l'auteur"}.
            </p>
            {s.can.withdraw ? (
              <div>
                <Button disabled={act.isPending} onClick={() => act.mutate({ kind: "withdraw" })}>
                  Retirer ma suggestion
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </article>
      <RejectSheet
        suggestion={s}
        open={sheet === "reject"}
        onClose={() => setSheet(null)}
        onDone={(message) => act.mutate({ kind: "reject", message })}
      />
      <ConvertSuggestionSheet
        spaceId={spaceId}
        recipeId={recipeId}
        suggestionId={suggestionId}
        open={sheet === "convert"}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
