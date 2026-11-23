// F-GENERER, etape "Repas a generer" [D230] : les repas de la periode, pre-remplis par
// la grille du profil [D114] ; decocher un repas l'exclut, un tag l'epingle, pour cette
// generation seulement (le profil ne change pas). Verrouille, "Pas de repas" et, sans
// "Remplacer", repas deja prevu : affiches, non cochables (la generation les laisse).
import {
  generationPreviewSchema,
  type DatedGridCellBody,
  type GenerationPreview,
  type GenerationProfile,
  type Meal,
  type MealTime,
} from "@fm/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Icon } from "../../ui/icon.tsx";
import { SheetFooter } from "../../ui/sheet.tsx";
import { TagSheet } from "../recipes/components/tag-sheet.tsx";
import { tagCatalogQuery } from "../recipes/queries.ts";
import { addDays, weekdayOf, whenLabel } from "./dates.ts";
import { mealsQuery, profileQuery, settingsQuery } from "./queries.ts";

/** Options choisies a l'etape precedente. */
export interface GenerateChoice {
  profileId: string;
  from: string;
  to: string;
  replace: boolean;
}

interface Row {
  date: string;
  mealTime: MealTime;
  /** Repas laisse par la generation : affiche, non cochable. */
  fixed: boolean;
  /** Repas deja prevu, dit sous la date. */
  note: string | null;
}

export interface RowState {
  on: boolean;
  tag: { id: string; name: string } | null;
}

const cellKey = (date: string, mealTime: MealTime) => `${date}/${mealTime}`;

function rowsOf(
  choice: GenerateChoice,
  mealTimes: readonly MealTime[],
  meals: readonly Meal[]
): Row[] {
  const byCell = new Map(meals.map((meal) => [cellKey(meal.date, meal.mealTime), meal]));
  const rows: Row[] = [];
  for (let date = choice.from; date <= choice.to; date = addDays(date, 1)) {
    for (const mealTime of mealTimes) {
      const meal = byCell.get(cellKey(date, mealTime));
      const skipped = meal?.kind === "SKIPPED";
      const fixed = !!meal && (meal.locked || skipped || !choice.replace);
      const title = skipped ? "Pas de repas" : (meal?.title ?? null);
      rows.push({
        date,
        mealTime,
        fixed,
        note: title ? (meal?.locked ? `${title}, verrouillé` : title) : null,
      });
    }
  }
  return rows;
}

/** Etat de depart d'une case : celui de la grille du profil pour son jour. */
function initialState(rows: readonly Row[], profile: GenerationProfile): Map<string, RowState> {
  return new Map(
    rows.map((row) => {
      const cell = profile.grid.find(
        (c) => c.weekday === weekdayOf(row.date) && c.mealTime === row.mealTime
      );
      const tag =
        cell?.state === "PINNED" && cell.tag.status === "ACTIVE"
          ? { id: cell.tag.id, name: cell.tag.name }
          : null;
      return [cellKey(row.date, row.mealTime), { on: cell?.state !== "EXCLUDED", tag }];
    })
  );
}

/** Corps de la generation : les cases decochees et epinglees des repas generables. */
function cellsOf(rows: readonly Row[], state: ReadonlyMap<string, RowState>): DatedGridCellBody[] {
  return rows.flatMap((row): DatedGridCellBody[] => {
    const current = state.get(cellKey(row.date, row.mealTime));
    if (row.fixed || !current) return [];
    const at = { date: row.date, mealTime: row.mealTime };
    if (!current.on) return [{ ...at, state: "EXCLUDED" }];
    return current.tag ? [{ ...at, state: "PINNED", tagId: current.tag.id }] : [];
  });
}

/** Choix des repas a generer, gardes au retour depuis l'apercu. */
export type MealChoices = ReadonlyMap<string, RowState>;

function MealsForm({
  spaceId,
  choice,
  rows,
  profile,
  saved,
  onBack,
  onPreview,
}: {
  spaceId: string;
  choice: GenerateChoice;
  rows: Row[];
  profile: GenerationProfile;
  saved: MealChoices | null;
  onBack: () => void;
  onPreview: (preview: GenerationPreview, choices: MealChoices) => void;
}) {
  const guard = useWriteGuard();
  const catalog = useQuery(tagCatalogQuery(spaceId));
  const space = useQuery(spaceQuery(spaceId));
  const [state, setState] = useState<MealChoices>(() => saved ?? initialState(rows, profile));
  const [picking, setPicking] = useState<Row | null>(null);
  const update = (row: Row, change: Partial<RowState>) => {
    setState((current) => {
      const next = new Map(current);
      const key = cellKey(row.date, row.mealTime);
      const before = next.get(key) ?? { on: true, tag: null };
      next.set(key, { ...before, ...change });
      return next;
    });
  };
  const run = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${spaceId}/meal-plan/generate`,
        { ...choice, cells: cellsOf(rows, state) },
        generationPreviewSchema
      ),
    onSuccess: (preview) => {
      onPreview(preview, state);
    },
  });
  const count = rows.filter(
    (row) => !row.fixed && state.get(cellKey(row.date, row.mealTime))?.on
  ).length;
  const pickedTag = picking ? state.get(cellKey(picking.date, picking.mealTime))?.tag : null;

  return (
    <div className="fm-stack">
      <div className="flex items-center gap-2">
        <IconButton icon="arrow-left" label="Retour" onClick={onBack} />
        <small className="text-ink-muted">
          Décoche un repas pour le laisser, épingle un tag pour cette génération seulement.
        </small>
      </div>
      <FormAlert message={run.isError ? errorMessage(run.error) : undefined} />
      <ul className="fm-pick-list">
        {rows.map((row) => {
          const when = whenLabel(row.date, row.mealTime);
          const current = state.get(cellKey(row.date, row.mealTime));
          const on = !row.fixed && !!current?.on;
          return (
            <li key={cellKey(row.date, row.mealTime)} className="flex items-center gap-2">
              <label className="fm-pick min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={row.fixed}
                  onChange={(event) => {
                    update(row, { on: event.target.checked });
                  }}
                />
                <span className="fm-pick-text">
                  <b>{when}</b> {row.note ? <small>{row.note}</small> : null}
                </span>
              </label>
              {row.fixed ? null : (
                <button
                  type="button"
                  className="fm-chip shrink-0"
                  disabled={!on}
                  aria-pressed={!!current?.tag}
                  aria-label={
                    current?.tag
                      ? `${when} : tag ${current.tag.name}, changer`
                      : `${when} : épingler un tag`
                  }
                  onClick={() => {
                    setPicking(row);
                  }}
                >
                  <Icon name="tag" size={16} />
                  <span className="max-w-28 truncate">{current?.tag?.name ?? "Tag"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <TagSheet
        open={picking !== null}
        onClose={() => {
          setPicking(null);
        }}
        title="Choisir un tag"
        mode="single"
        catalog={catalog.data}
        spaceName={space.data?.name ?? ""}
        selected={pickedTag ? [pickedTag.id] : []}
        onChange={([id]) => {
          const tag = catalog.data?.tags.find((t) => t.id === id);
          if (picking && tag) update(picking, { tag: { id: tag.id, name: tag.name } });
        }}
        footer={
          pickedTag ? (
            <SheetFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  if (picking) update(picking, { tag: null });
                  setPicking(null);
                }}
              >
                Retirer le tag
              </Button>
            </SheetFooter>
          ) : undefined
        }
      />
      <SheetFooter>
        <Button
          variant="primary"
          block
          icon="sparkles"
          disabled={count === 0 || run.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            run.mutate();
          }}
        >
          Générer
        </Button>
        <span className="text-center text-sm text-ink-muted">
          {count === 0 ? "Aucun repas à générer." : `${String(count)} repas à générer`}
        </span>
      </SheetFooter>
    </div>
  );
}

/** Etape "Repas a generer" : charge reglages, profil et repas de la periode. */
export function GenerateMeals({
  spaceId,
  choice,
  saved,
  onBack,
  onPreview,
}: {
  spaceId: string;
  choice: GenerateChoice;
  /** Choix deja faits pour ces options (retour depuis l'apercu). */
  saved: MealChoices | null;
  onBack: () => void;
  onPreview: (preview: GenerationPreview, choices: MealChoices) => void;
}) {
  const settings = useQuery(settingsQuery(spaceId));
  const profile = useQuery(profileQuery(spaceId, choice.profileId));
  const meals = useQuery(mealsQuery(spaceId, choice.from, choice.to));
  const error = settings.error ?? profile.error ?? meals.error;
  if (error) return <FormAlert message={errorMessage(error)} />;
  if (!settings.data || !profile.data || !meals.data) {
    return <p className="m-0 text-sm text-ink-muted">Chargement…</p>;
  }
  return (
    <MealsForm
      spaceId={spaceId}
      choice={choice}
      rows={rowsOf(choice, settings.data.mealTimes, meals.data)}
      profile={profile.data}
      saved={saved}
      onBack={onBack}
      onPreview={onPreview}
    />
  );
}
