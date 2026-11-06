// Adaptation [D17, D140, D166] : F-ADAPTER (copie liee dans un de ses espaces),
// lien vers l'original sur le detail, tableau de differences (comparaison, suggestions).
import { recipeSchema, type DiffEntry, type Recipe, type Unit } from "@fm/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spacesQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { SegmentedControl } from "../../ui/controls.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { describeDiff } from "./format.ts";

export function AdaptSheet({
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
  const navigate = useNavigate();
  const toast = useToast();
  const spaces = useQuery(spacesQuery);
  const targets = (spaces.data ?? []).filter((space) => !space.deletedAt);
  const [target, setTarget] = useState<string>();
  const chosen =
    targets.find((space) => space.id === target) ?? targets.find((s) => s.id === spaceId);
  const adapt = useMutation({
    mutationFn: (targetSpaceId: string) =>
      api.post(`/spaces/${spaceId}/recipes/${recipe.id}/adapt`, { targetSpaceId }, recipeSchema),
    onSuccess: (created) => {
      const name = targets.find((space) => space.id === created.homeSpaceId)?.name ?? "";
      toast(`Adaptation créée dans ${name}`, { tone: "success" });
      onClose();
      void navigate(`/s/${created.homeSpaceId}/recipes/${created.id}/edit`);
    },
  });
  const author = recipe.author.username;
  return (
    <Sheet open={open} onClose={onClose} title="Adapter pour un espace">
      <div className="fm-stack">
        <span className="flex flex-col">
          <b>{recipe.title}</b>
          <small className="text-ink-muted">
            par {author} · {recipe.homeSpace.name}
          </small>
        </span>
        <p className="m-0">
          Crée ta version de la recette. L'original de {author} n'est jamais modifié.
        </p>
        {chosen ? (
          <SegmentedControl
            label="Espace de l'adaptation"
            options={targets.map((space) => ({ value: space.id, label: space.name }))}
            value={chosen.id}
            onChange={setTarget}
          />
        ) : null}
        <small className="text-ink-muted">
          Elle reste liée à l'original : si {author} modifie sa recette, tu verras « Original
          modifié » et tu pourras comparer.
        </small>
        <FormAlert message={adapt.isError ? errorMessage(adapt.error) : undefined} />
        <SheetFooter>
          <Button
            variant="primary"
            block
            disabled={!chosen || adapt.isPending}
            onClick={() => {
              if (chosen) adapt.mutate(chosen.id);
            }}
          >
            Créer et modifier l'adaptation
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

/** Sous le titre d'une adaptation : son original, et le badge s'il a change. */
export function AdaptedFromNotice({ spaceId, recipe }: { spaceId: string; recipe: Recipe }) {
  const from = recipe.adaptedFrom;
  if (!from) return null;
  return (
    <div className="fm-stack gap-2">
      <span className="text-sm text-ink-muted">
        Adaptée de {from.title} · {from.author.username} ({from.homeSpace.name})
        {from.deleted ? " · Original supprimé" : ""}
      </span>
      {from.changed ? (
        <div className="fm-option" role="status">
          <span className="fm-option-icon">
            <Icon name="refresh" />
          </span>
          <span className="fm-option-text">
            <b>Original modifié</b>
            <small>
              {from.author.username} a changé sa recette depuis ton adaptation.{" "}
              <Link to={`/s/${spaceId}/recipes/${recipe.id}/compare`}>
                Comparer avec l'original
              </Link>
            </small>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Differences en tableau : une ligne par changement, deux colonnes de valeurs. */
export function DiffTable({
  caption,
  columns,
  entries,
  units,
  conflicts,
}: {
  caption: string;
  columns: readonly [string, string];
  entries: readonly DiffEntry[];
  units: readonly Unit[];
  /** Lignes a signaler (conflit d'une suggestion). */
  conflicts?: (entry: DiffEntry) => boolean;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-ink-muted">
          <th scope="col" className="py-1 font-normal">
            <span className="sr-only">Partie</span>
          </th>
          <th scope="col" className="py-1 font-normal">
            {columns[0]}
          </th>
          <th scope="col" className="py-1 font-normal">
            {columns[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const { label, before, after } = describeDiff(entry, units);
          const conflict = conflicts?.(entry) ?? false;
          return (
            <tr key={i} className="border-t border-line align-top">
              <th scope="row" className="py-2 pr-2 text-left font-semibold">
                {label}
                {conflict ? (
                  <small className="block text-danger-text">Changé des deux côtés</small>
                ) : null}
              </th>
              <td className="py-2 pr-2 text-ink-muted">{before}</td>
              <td className="py-2">{after}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
