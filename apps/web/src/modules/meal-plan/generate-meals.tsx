// F-GENERER, accordeon "Choisir les repas" [D230] : la grille des repas de la periode,
// pre-remplie par la grille du profil [D114]. Un toucher sur une case ouvre son choix
// (genere, exclu, tag epingle), pour cette generation seulement : le profil ne change
// pas. Verrouille, "Pas de repas" et, sans "Remplacer", repas deja prevu : affiches,
// non modifiables (la generation les laisse). Telephone : un jour par ligne, Midi et
// Soir en colonnes ; grand ecran : la disposition du planning, une grille par semaine.
import type { DatedGridCellBody, GenerationProfile, Meal, MealTime } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { useMediaQuery } from "../../lib/use-media-query.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup } from "../../ui/controls.tsx";
import { cx } from "../../ui/cx.ts";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { addDays, shortDay, weekdayOf, whenLabel } from "./dates.ts";
import { MEAL_TIME_LABELS } from "./format.ts";
import { mealsQuery, profileQuery, settingsQuery } from "./queries.ts";
import { TagChoice } from "./rule-sheet.tsx";

/** Feuille centree et elargie (meme seuil que `.fm-sheet`) : la disposition du planning. */
const WIDE = "(min-width: 768px)";

/** Options choisies dans F-GENERER. */
export interface GenerateChoice {
  profileId: string;
  from: string;
  to: string;
  replace: boolean;
}

/** Ce que la grille envoie avec la generation. */
export interface MealsSelection {
  cells: DatedGridCellBody[];
  count: number;
}

interface Row {
  date: string;
  mealTime: MealTime;
  /** Repas laisse par la generation : affiche, non modifiable. */
  fixed: boolean;
  /** Repas deja prevu (titre ou "Pas de repas"). */
  note: string | null;
  locked: boolean;
}

type CellState =
  | { state: "GENERATED" }
  | { state: "EXCLUDED" }
  | { state: "PINNED"; tag: { id: string; name: string } };

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
      rows.push({
        date,
        mealTime,
        fixed: !!meal && (meal.locked || skipped || !choice.replace),
        note: skipped ? "Pas de repas" : (meal?.title ?? null),
        locked: !!meal?.locked,
      });
    }
  }
  return rows;
}

/** Etat de depart d'une case : celui de la grille du profil pour son jour. */
function initialState(rows: readonly Row[], profile: GenerationProfile): Map<string, CellState> {
  return new Map(
    rows.map((row): [string, CellState] => {
      const cell = profile.grid.find(
        (c) => c.weekday === weekdayOf(row.date) && c.mealTime === row.mealTime
      );
      const state: CellState =
        cell?.state === "EXCLUDED"
          ? { state: "EXCLUDED" }
          : cell?.state === "PINNED" && cell.tag.status === "ACTIVE"
            ? { state: "PINNED", tag: { id: cell.tag.id, name: cell.tag.name } }
            : { state: "GENERATED" };
      return [cellKey(row.date, row.mealTime), state];
    })
  );
}

function selectionOf(rows: readonly Row[], states: ReadonlyMap<string, CellState>): MealsSelection {
  const cells: DatedGridCellBody[] = [];
  let count = 0;
  for (const row of rows) {
    const current = states.get(cellKey(row.date, row.mealTime));
    if (row.fixed || !current) continue;
    const at = { date: row.date, mealTime: row.mealTime };
    if (current.state === "EXCLUDED") {
      cells.push({ ...at, state: "EXCLUDED" });
      continue;
    }
    count++;
    if (current.state === "PINNED") cells.push({ ...at, state: "PINNED", tagId: current.tag.id });
  }
  return { cells, count };
}

function status(row: Row, current: CellState | undefined): string {
  if (row.fixed) return [row.note, row.locked ? "verrouillé" : null].filter(Boolean).join(", ");
  if (current?.state === "EXCLUDED") return "exclu";
  if (current?.state === "PINNED") return `tag ${current.tag.name} épinglé`;
  return "généré";
}

function CellButton({
  row,
  current,
  onOpen,
}: {
  row: Row;
  current: CellState | undefined;
  onOpen: () => void;
}) {
  const state = row.fixed ? null : (current?.state ?? "GENERATED");
  return (
    <button
      type="button"
      disabled={row.fixed}
      aria-label={`${whenLabel(row.date, row.mealTime)} : ${status(row, current)}`}
      className={cx(
        "flex h-11 w-full items-center justify-center gap-1 overflow-hidden rounded-md border px-1 text-xs leading-tight",
        state === null && "cursor-default border-transparent bg-surface text-ink-muted",
        state === "GENERATED" && "border-line bg-surface-raised",
        state === "EXCLUDED" && "border-dashed border-line-strong bg-surface text-ink-muted",
        state === "PINNED" && "border-accent bg-accent-soft text-accent-text"
      )}
      onClick={onOpen}
    >
      {row.fixed && row.locked ? <Icon name="lock" size={12} /> : null}
      <span aria-hidden="true" className="truncate">
        {row.fixed
          ? (row.note ?? "")
          : current?.state === "EXCLUDED"
            ? "—"
            : current?.state === "PINNED"
              ? current.tag.name
              : ""}
      </span>
    </button>
  );
}

/** Choix d'une case : genere, exclu ou tag epingle (comme la grille du profil). */
function CellForm({
  spaceId,
  current,
  onDone,
}: {
  spaceId: string;
  current: CellState;
  onDone: (next: CellState) => void;
}) {
  const [state, setState] = useState<CellState["state"]>(current.state);
  const [tag, setTag] = useState(current.state === "PINNED" ? current.tag : null);
  const [problem, setProblem] = useState<string>();
  return (
    <div className="fm-stack">
      <FormAlert message={problem} />
      <RadioGroup
        label="Ce repas"
        options={[
          { value: "GENERATED", label: "Généré", hint: "La génération y place un repas." },
          { value: "EXCLUDED", label: "Exclu", hint: "Pas de génération pour ce repas." },
          {
            value: "PINNED",
            label: "Épingler un tag",
            hint: "Seulement des recettes de ce tag.",
          },
        ]}
        value={state}
        onChange={setState}
      />
      {state === "PINNED" ? (
        <div className="flex flex-col gap-2">
          <span className="fm-label">Tag épinglé</span>
          <TagChoice
            spaceId={spaceId}
            label="Tag épinglé"
            value={tag?.id ?? null}
            onChange={(id, name) => {
              setTag({ id, name });
            }}
          />
        </div>
      ) : null}
      <SheetFooter>
        <Button
          variant="primary"
          block
          onClick={() => {
            if (state !== "PINNED") {
              onDone({ state });
              return;
            }
            if (!tag) {
              setProblem("Choisis le tag à épingler.");
              return;
            }
            onDone({ state, tag });
          }}
        >
          OK
        </Button>
      </SheetFooter>
    </div>
  );
}

/** Semaines de la periode, pour la disposition du planning. */
function weeksOf(dates: readonly string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));
  return weeks;
}

function DayHeader({ date }: { date: string }) {
  const { day, num } = shortDay(date);
  return (
    <>
      {day} {num}
    </>
  );
}

function Grid({
  spaceId,
  rows,
  mealTimes,
  profile,
  onChange,
}: {
  spaceId: string;
  rows: Row[];
  mealTimes: readonly MealTime[];
  profile: GenerationProfile;
  onChange: (selection: MealsSelection) => void;
}) {
  const wide = useMediaQuery(WIDE);
  const [states, setStates] = useState(() => initialState(rows, profile));
  const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => {
    onChange(selectionOf(rows, states));
  }, [rows, states, onChange]);
  const byCell = new Map(rows.map((row) => [cellKey(row.date, row.mealTime), row]));
  const dates = [...new Set(rows.map((row) => row.date))];
  const cell = (date: string, mealTime: MealTime) => {
    const row = byCell.get(cellKey(date, mealTime));
    if (!row) return null;
    return (
      <CellButton
        row={row}
        current={states.get(cellKey(date, mealTime))}
        onOpen={() => {
          setOpen(row);
        }}
      />
    );
  };
  const table = "w-full table-fixed border-separate border-spacing-1";
  const head = "text-xs font-semibold text-ink-muted";

  return (
    <>
      {wide ? (
        weeksOf(dates).map((week) => (
          <table key={week[0]} className={table}>
            <thead>
              <tr>
                <th scope="col" className="w-12">
                  <span className="sr-only">Repas</span>
                </th>
                {week.map((date) => (
                  <th key={date} scope="col" className={head}>
                    <DayHeader date={date} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealTimes.map((mealTime) => (
                <tr key={mealTime}>
                  <th scope="row" className={cx(head, "text-left")}>
                    {MEAL_TIME_LABELS[mealTime]}
                  </th>
                  {week.map((date) => (
                    <td key={date} className="p-0">
                      {cell(date, mealTime)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))
      ) : (
        <table className={table}>
          <thead>
            <tr>
              <th scope="col" className="w-16">
                <span className="sr-only">Jour</span>
              </th>
              {mealTimes.map((mealTime) => (
                <th key={mealTime} scope="col" className={head}>
                  {MEAL_TIME_LABELS[mealTime]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => (
              <tr key={date}>
                <th scope="row" className={cx(head, "text-left")}>
                  <DayHeader date={date} />
                </th>
                {mealTimes.map((mealTime) => (
                  <td key={mealTime} className="p-0">
                    {cell(date, mealTime)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="m-0 text-xs text-ink-muted">
        Touche un repas pour l'exclure ou y épingler un tag, pour cette génération seulement. —
        exclu · nom d'un tag : tag épinglé.
      </p>
      <Sheet
        open={open !== null}
        onClose={() => {
          setOpen(null);
        }}
        title={open ? whenLabel(open.date, open.mealTime) : ""}
      >
        {open ? (
          <CellForm
            spaceId={spaceId}
            current={states.get(cellKey(open.date, open.mealTime)) ?? { state: "GENERATED" }}
            onDone={(next) => {
              setStates((current) => new Map(current).set(cellKey(open.date, open.mealTime), next));
              setOpen(null);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

/** Grille des repas a generer : charge reglages, profil et repas de la periode. */
export function MealsChoice({
  spaceId,
  choice,
  onChange,
}: {
  spaceId: string;
  choice: GenerateChoice;
  onChange: (selection: MealsSelection) => void;
}) {
  const settings = useQuery(settingsQuery(spaceId));
  const profile = useQuery(profileQuery(spaceId, choice.profileId));
  const meals = useQuery(mealsQuery(spaceId, choice.from, choice.to));
  const error = settings.error ?? profile.error ?? meals.error;
  const rows = useMemo(
    () =>
      settings.data && meals.data ? rowsOf(choice, settings.data.mealTimes, meals.data) : null,
    [settings.data, meals.data, choice]
  );
  if (error) return <FormAlert message={errorMessage(error)} />;
  if (!settings.data || !profile.data || !rows) {
    return <p className="m-0 text-sm text-ink-muted">Chargement…</p>;
  }
  return (
    <Grid
      spaceId={spaceId}
      rows={rows}
      mealTimes={settings.data.mealTimes}
      profile={profile.data}
      onChange={onChange}
    />
  );
}
