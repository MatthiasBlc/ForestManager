// E-HISTORIQUE : revisions d'une recette, de la plus recente a la plus ancienne,
// avec ce qui a change ; restaurer cree une nouvelle revision [D05, D55, F-REC-8].
import type { Recipe, RecipeRevision, RevisionChange, RevisionSource } from "@fm/shared";
import { recipeSchema } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { Button } from "../../ui/button.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { recipeFailure, recipeQuery, recipesKey, revisionsQuery } from "./queries.ts";
import { RecipeUnavailable } from "./recipe-page.tsx";

const SOURCE_LABELS: Record<RevisionSource, (name: string) => string> = {
  CREATE: (name) => `Créée par ${name}`,
  EDIT: (name) => `Modifiée par ${name}`,
  RESTORE: (name) => `Restaurée par ${name}`,
  SUGGESTION: (name) => `Suggestion de ${name} acceptée`,
  IMPORT: (name) => `Importée par ${name}`,
};

const CHANGE_LABELS: Record<RevisionChange, string> = {
  title: "titre",
  description: "description",
  notes: "notes",
  source: "source",
  yield: "portions",
  times: "temps",
  base: "base",
  blocks: "blocs",
  ingredients: "ingrédients",
  steps: "étapes",
};

/** "Titre, temps · 28 oct." ; la date seule pour la premiere revision. */
function revisionDetail(revision: RecipeRevision): string {
  const date = new Date(revision.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const changes = revision.changes.map((change) => CHANGE_LABELS[change]).join(", ");
  if (!changes) return date;
  return `${changes.charAt(0).toUpperCase()}${changes.slice(1)} · ${date}`;
}

function HistoryView({
  spaceId,
  recipe,
  revisions,
}: {
  spaceId: string;
  recipe: Recipe;
  revisions: readonly RecipeRevision[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const recipePath = `/s/${spaceId}/recipes/${recipe.id}`;
  const restore = useMutation({
    mutationFn: (number: number) =>
      api.post(
        `/spaces/${spaceId}/recipes/${recipe.id}/revisions/${String(number)}/restore`,
        { revision: recipe.currentRevision },
        recipeSchema
      ),
    onSuccess: async (saved, number) => {
      queryClient.setQueryData(recipeQuery(spaceId, recipe.id).queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      await queryClient.invalidateQueries({
        queryKey: revisionsQuery(spaceId, recipe.id).queryKey,
      });
      toast(`Révision ${String(number)} restaurée`, { tone: "success" });
      void navigate(recipePath, { replace: true });
    },
  });

  return (
    <>
      <PageChrome
        top={
          <TopBar
            title="Historique"
            onBack={() => {
              void navigate(recipePath);
            }}
          />
        }
      />
      <div className="fm-stack mx-auto w-full max-w-3xl p-4">
        <b className="text-[17px]">{recipe.title}</b>
        <FormAlert message={restore.isError ? errorMessage(restore.error) : undefined} />
        <ol
          aria-label={`Révisions de ${recipe.title}`}
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {revisions.map((revision) => {
            const current = revision.number === recipe.currentRevision;
            return (
              <li
                key={revision.number}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-3"
              >
                <span className="min-w-7 font-mono text-sm leading-5 font-semibold text-ink-muted">
                  {revision.number}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[15px]">
                      {SOURCE_LABELS[revision.source](revision.author.username)}
                    </b>
                    {current ? <Badge tone="accent">Actuelle</Badge> : null}
                  </span>
                  <span className="text-sm text-ink-muted">{revisionDetail(revision)}</span>
                </span>
                {recipe.can.edit && !current ? (
                  <Button
                    size="sm"
                    aria-label={`Restaurer la révision ${String(revision.number)}`}
                    disabled={restore.isPending}
                    onClick={() => {
                      restore.mutate(revision.number);
                    }}
                  >
                    Restaurer
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
        <span className="text-sm text-ink-muted">
          Restaurer crée une nouvelle révision : rien n'est effacé.
        </span>
      </div>
    </>
  );
}

export function HistoryPage() {
  const { spaceId = "", recipeId = "" } = useParams();
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const revisions = useQuery(revisionsQuery(spaceId, recipeId));
  const failure = recipeFailure(recipe);
  if (failure) {
    return (
      <RecipeUnavailable
        spaceId={spaceId}
        failure={failure}
        onRetry={() => void recipe.refetch()}
      />
    );
  }
  if (!recipe.data || !revisions.data) return <Skeleton />;
  return <HistoryView spaceId={spaceId} recipe={recipe.data} revisions={revisions.data} />;
}
