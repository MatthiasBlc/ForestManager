// E-COMPARER-ORIGINAL [D17, D105] : en lecture seule, ce qui a change dans
// l'original depuis la revision vue, et ce que l'espace a change dans son
// adaptation. Rien ne change tout seul : on reporte a la main, puis "Marquer comme vu".
import { diffContents } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { Button } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { DiffTable } from "./adaptation.tsx";
import { comparisonQuery, recipeFailure, recipeQuery, recipesKey, unitsQuery } from "./queries.ts";
import { RecipeUnavailable } from "./recipe-page.tsx";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function ComparePage() {
  const { spaceId = "", recipeId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const comparison = useQuery(comparisonQuery(spaceId, recipeId));
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const units = useQuery(unitsQuery);
  const { data: space } = useQuery(spaceQuery(spaceId));
  const back = () => {
    void navigate(`/s/${spaceId}/recipes/${recipeId}`);
  };
  const seen = useMutation({
    mutationFn: () => api.post(`/spaces/${spaceId}/recipes/${recipeId}/compare/seen`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipeQuery(spaceId, recipeId).queryKey });
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      toast("Marqué comme vu", { tone: "success" });
      back();
    },
  });

  const chrome = <PageChrome top={<TopBar title="Comparer" onBack={back} />} />;
  const failure = recipeFailure(comparison);
  if (failure) {
    return (
      <RecipeUnavailable
        spaceId={spaceId}
        failure={failure}
        onRetry={() => void comparison.refetch()}
      />
    );
  }
  if (!comparison.data || !units.data || !recipe.data) {
    return (
      <>
        {chrome}
        <Skeleton />
      </>
    );
  }
  const { original, base, current, adaptation, canMarkSeen } = comparison.data;
  const originalChanges = current ? diffContents(base, current) : [];
  const ownChanges = diffContents(base, adaptation);
  const spaceName = space?.name ?? "ton espace";
  return (
    <>
      {chrome}
      <article className="fm-stack mx-auto w-full max-w-3xl p-4" aria-labelledby="compare-title">
        <div className="flex flex-col gap-1">
          <h1 id="compare-title" className="m-0 font-display text-[26px] leading-8 font-bold">
            {adaptation.title}
          </h1>
          <span className="text-sm text-ink-muted">
            Adaptée dans {spaceName} · original de {original.author.username} (
            {original.homeSpace.name})
          </span>
        </div>

        <section className="fm-stack" aria-labelledby="compare-original">
          <h2 id="compare-original" className="m-0 font-display text-lg font-semibold">
            {original.deleted ? "Original supprimé" : "Original modifié"}
          </h2>
          {original.deleted ? (
            <p className="m-0 text-ink-muted">
              L'original n'existe plus : ton adaptation vit seule.
            </p>
          ) : original.lastChange ? (
            <>
              <small className="text-ink-muted">
                le {day(original.lastChange.at)}, par {original.lastChange.by.username}
              </small>
              {originalChanges.length > 0 ? (
                <DiffTable
                  caption="Changements de l'original"
                  columns={["Avant", "Maintenant"]}
                  entries={originalChanges}
                  units={units.data}
                />
              ) : (
                <p className="m-0 text-ink-muted">Seuls les tags ou la mise en forme ont changé.</p>
              )}
            </>
          ) : (
            <p className="m-0 text-ink-muted">Rien de nouveau depuis la dernière fois.</p>
          )}
        </section>

        <section className="fm-stack" aria-labelledby="compare-own">
          <h2 id="compare-own" className="m-0 font-display text-lg font-semibold">
            Ce que {spaceName} a changé
          </h2>
          {ownChanges.length > 0 ? (
            <DiffTable
              caption={`Changements de ${spaceName}`}
              columns={["Original", "Chez toi"]}
              entries={ownChanges}
              units={units.data}
            />
          ) : (
            <p className="m-0 text-ink-muted">Rien pour l'instant : c'est encore l'original.</p>
          )}
        </section>

        <small className="text-ink-muted">
          Rien ne change tout seul : reporte à la main ce que tu veux garder, puis marque comme vu.
        </small>
        <FormAlert message={seen.isError ? errorMessage(seen.error) : undefined} />
        {canMarkSeen ? (
          <div className="flex gap-2">
            <Link
              to={`/s/${spaceId}/recipes/${recipeId}/edit`}
              className="fm-btn fm-btn-secondary flex-1"
            >
              Modifier
            </Link>
            {original.lastChange ? (
              <Button
                variant="primary"
                className="flex-1"
                disabled={seen.isPending}
                onClick={() => seen.mutate()}
              >
                Marquer comme vu
              </Button>
            ) : null}
          </div>
        ) : null}
      </article>
    </>
  );
}
