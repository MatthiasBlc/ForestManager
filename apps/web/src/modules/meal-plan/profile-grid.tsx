// Grille jours x repas d'un profil [D114] : chaque case est generee, exclue (pas
// de generation) ou epinglee a un tag. Seuls les repas planifies par l'espace
// apparaissent, la semaine commence au jour regle.
import {
  WEEKDAYS,
  generationProfileSchema,
  type GenerationProfile,
  type GridCell,
  type MealTime,
  type PutGridBody,
  type Weekday,
} from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup } from "../../ui/controls.tsx";
import { TagChoice } from "./rule-sheet.tsx";
import { cx } from "../../ui/cx.ts";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { MEAL_TIME_LABELS, MEAL_TIME_WORDS, WEEKDAY_LABELS } from "./format.ts";
import { profileQuery, profilesKey } from "./queries.ts";

type CellState = "GENERATED" | "EXCLUDED" | "PINNED";

const sameCell = (cell: GridCell, weekday: Weekday, mealTime: MealTime) =>
  cell.weekday === weekday && cell.mealTime === mealTime;

function cellName(weekday: Weekday, mealTime: MealTime): string {
  return `${WEEKDAY_LABELS[weekday]} ${MEAL_TIME_WORDS[mealTime]}`;
}

function cellStatus(cell: GridCell | undefined): string {
  if (!cell) return "généré";
  if (cell.state === "EXCLUDED") return "exclu";
  return cell.tag.status === "DELETED"
    ? `tag ${cell.tag.name} supprimé`
    : `tag ${cell.tag.name} épinglé`;
}

/** Semaine reordonnee a partir du jour de debut regle. */
function orderedDays(weekStartsOn: Weekday): Weekday[] {
  const start = WEEKDAYS.indexOf(weekStartsOn);
  return [...WEEKDAYS.slice(start), ...WEEKDAYS.slice(0, start)];
}

/** Corps du PUT : la grille entiere, une case remplacee. */
function withCell(
  grid: readonly GridCell[],
  weekday: Weekday,
  mealTime: MealTime,
  state: CellState,
  tagId: string | null
): PutGridBody {
  const others = grid
    .filter((cell) => !sameCell(cell, weekday, mealTime))
    .map((cell) =>
      cell.state === "EXCLUDED"
        ? { weekday: cell.weekday, mealTime: cell.mealTime, state: "EXCLUDED" as const }
        : {
            weekday: cell.weekday,
            mealTime: cell.mealTime,
            state: "PINNED" as const,
            tagId: cell.tag.id,
          }
    );
  if (state === "EXCLUDED") others.push({ weekday, mealTime, state: "EXCLUDED" });
  if (state === "PINNED" && tagId) others.push({ weekday, mealTime, state: "PINNED", tagId });
  const order = (c: { weekday: Weekday; mealTime: MealTime }) =>
    WEEKDAYS.indexOf(c.weekday) * 2 + (c.mealTime === "LUNCH" ? 0 : 1);
  return { cells: others.sort((a, b) => order(a) - order(b)) };
}

function CellForm({
  spaceId,
  profile,
  weekday,
  mealTime,
  onDone,
}: {
  spaceId: string;
  profile: GenerationProfile;
  weekday: Weekday;
  mealTime: MealTime;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const guard = useWriteGuard();
  const current = profile.grid.find((cell) => sameCell(cell, weekday, mealTime));
  const [state, setState] = useState<CellState>(current?.state ?? "GENERATED");
  const [tagId, setTagId] = useState<string | null>(
    current?.state === "PINNED" && current.tag.status === "ACTIVE" ? current.tag.id : null
  );
  const [problem, setProblem] = useState<string>();
  const save = useMutation({
    mutationFn: (body: PutGridBody) =>
      api.put(
        `/spaces/${spaceId}/meal-plan/profiles/${profile.id}/grid`,
        body,
        generationProfileSchema
      ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(profileQuery(spaceId, profile.id).queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: profilesKey(spaceId) });
      onDone();
    },
  });

  return (
    <div className="fm-stack">
      <FormAlert message={problem ?? (save.isError ? errorMessage(save.error) : undefined)} />
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
          <TagChoice spaceId={spaceId} label="Tag épinglé" value={tagId} onChange={setTagId} />
        </div>
      ) : null}
      <SheetFooter>
        <Button
          variant="primary"
          block
          disabled={save.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            if (state === "PINNED" && !tagId) {
              setProblem("Choisis le tag à épingler.");
              return;
            }
            setProblem(undefined);
            save.mutate(withCell(profile.grid, weekday, mealTime, state, tagId));
          }}
        >
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

export function ProfileGrid({
  spaceId,
  profile,
  mealTimes,
  weekStartsOn,
}: {
  spaceId: string;
  profile: GenerationProfile;
  mealTimes: readonly MealTime[];
  weekStartsOn: Weekday;
}) {
  const [open, setOpen] = useState<{ weekday: Weekday; mealTime: MealTime } | null>(null);
  const days = orderedDays(weekStartsOn);
  return (
    <section aria-labelledby="profile-grid-title" className="fm-stack">
      <h3 id="profile-grid-title" className="m-0 text-base font-bold">
        Repas de la semaine
      </h3>
      <p className="m-0 text-sm text-ink-muted">
        Touche un repas pour l'exclure de la génération ou y épingler un tag.
      </p>
      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            <th scope="col" className="w-12">
              <span className="sr-only">Repas</span>
            </th>
            {days.map((day) => (
              <th key={day} scope="col" className="text-xs font-semibold text-ink-muted">
                <abbr title={WEEKDAY_LABELS[day]} className="no-underline">
                  {WEEKDAY_LABELS[day].slice(0, 3)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mealTimes.map((mealTime) => (
            <tr key={mealTime}>
              <th scope="row" className="text-left text-xs font-semibold text-ink-muted">
                {MEAL_TIME_LABELS[mealTime]}
              </th>
              {days.map((weekday) => {
                const cell = profile.grid.find((c) => sameCell(c, weekday, mealTime));
                return (
                  <td key={weekday} className="p-0">
                    <button
                      type="button"
                      aria-label={`${cellName(weekday, mealTime)} : ${cellStatus(cell)}`}
                      className={cx(
                        "flex h-11 w-full items-center justify-center overflow-hidden rounded-md border px-0.5 text-[11px] leading-tight",
                        !cell && "border-line bg-surface-raised",
                        cell?.state === "EXCLUDED" &&
                          "border-dashed border-line-strong bg-surface text-ink-muted",
                        cell?.state === "PINNED" &&
                          (cell.tag.status === "DELETED"
                            ? "border-line-strong bg-warning-soft text-warning-text line-through"
                            : "border-accent bg-accent-soft text-accent-text")
                      )}
                      onClick={() => {
                        setOpen({ weekday, mealTime });
                      }}
                    >
                      <span aria-hidden="true" className="truncate">
                        {cell?.state === "EXCLUDED"
                          ? "—"
                          : cell?.state === "PINNED"
                            ? cell.tag.name
                            : ""}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-xs text-ink-muted">
        — exclu : pas de génération · nom d'un tag : tag épinglé
      </p>
      <Sheet
        open={open !== null}
        onClose={() => {
          setOpen(null);
        }}
        title={open ? cellName(open.weekday, open.mealTime) : ""}
      >
        {open ? (
          <CellForm
            spaceId={spaceId}
            profile={profile}
            weekday={open.weekday}
            mealTime={open.mealTime}
            onDone={() => {
              setOpen(null);
            }}
          />
        ) : null}
      </Sheet>
    </section>
  );
}
