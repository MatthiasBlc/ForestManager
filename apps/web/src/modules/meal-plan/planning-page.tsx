// E-PLANNING [P10, D180] : calendrier continu de l'espace, semaine par semaine.
// Bureau : grille jours x repas. Mobile : "Jour | Semaine" (D111). Un repas-recette
// s'ouvre au toucher, F-REPAS par appui long ou clic droit ; un repas se glisse sur un
// autre pour les echanger, a la souris ou au doigt apres l'appui long [D204] ; "Echanger"
// de F-REPAS reste (mode echange, D112). Sans le droit de modifier : lecture seule.
import {
  type Meal,
  type MealCell,
  type MealPlanSettings,
  type MealTime,
  type SpaceRole,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useMediaQuery } from "../../lib/use-media-query.ts";
import { PullToRefresh } from "../../ui/pull-to-refresh.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { SegmentedControl } from "../../ui/controls.tsx";
import { cx } from "../../ui/cx.ts";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { usePointerDrag } from "../../ui/use-pointer-drag.ts";
import { useToast } from "../../ui/use-toast.ts";
import {
  addDays,
  dayLabel,
  shortDay,
  todayIso,
  weekDays,
  weekLabel,
  weekStart,
  whenLabel,
} from "./dates.ts";
import { MEAL_TIME_LABELS } from "./format.ts";
import { GenerateSheet } from "./generate-sheet.tsx";
import { EmptyCell, MealSlot, type SlotKind } from "./meal-slot.tsx";
import { MealSheet } from "./meal-sheet.tsx";
import { mealsKey, mealsQuery, settingsQuery } from "./queries.ts";
import { SettingsSheet } from "./settings-sheet.tsx";
import { useUrlFlag } from "../../lib/use-url-flag.ts";

const WIDE = "(min-width: 1024px)";

const READ_ONLY_NOTE: Record<SpaceRole, string> = {
  MEMBER: "",
  MODERATOR: "Seuls les modérateurs et le propriétaire modifient les repas.",
  OWNER: "Seul le propriétaire modifie les repas.",
};

const cellId = (cell: MealCell) => `${cell.date}/${cell.mealTime}`;
const parseCell = (id: string): MealCell => {
  const [date = "", mealTime = "LUNCH"] = id.split("/");
  return { date, mealTime: mealTime as MealTime };
};

function slotKind(meal: Meal | undefined): SlotKind {
  if (!meal) return "empty";
  if (meal.kind === "SKIPPED") return "off";
  return meal.kind === "RECIPE" && meal.recipe ? "recipe" : "text";
}

interface CalendarProps {
  days: string[];
  mealTimes: MealTime[];
  meals: ReadonlyMap<string, Meal>;
  settings: MealPlanSettings;
  /** Case dont on cherche la cible d'echange (mode echange). */
  swapFrom: MealCell | null;
  onCell: (cell: MealCell) => void;
  /** F-REPAS d'un repas-recette (appui long, clic droit, touche Menu). */
  onMenu: (cell: MealCell) => void;
  spaceId: string;
  /** Glisser pour echanger, si l'on peut modifier (sinon `null`). */
  drag: ReturnType<typeof usePointerDrag> | null;
  /** Cases qui viennent d'etre echangees (animation). */
  swapped: readonly string[];
  today: string;
}

/** Une case : MealSlot, ou case vide inerte en lecture seule. */
function Cell({
  cell,
  props,
  compact = false,
}: {
  cell: MealCell;
  props: CalendarProps;
  compact?: boolean;
}) {
  const { meals, settings, swapFrom, onCell, onMenu, drag, swapped, spaceId } = props;
  const id = cellId(cell);
  const meal = meals.get(id);
  const kind = slotKind(meal);
  if (kind === "empty" && !settings.can.edit) return <EmptyCell />;
  const servings =
    meal?.servings && meal.servings !== settings.defaultServings ? meal.servings : null;
  return (
    <MealSlot
      kind={kind}
      title={meal?.title}
      servings={servings}
      locked={meal?.locked}
      when={whenLabel(cell.date, cell.mealTime)}
      placeholder={swapFrom ? "Déplacer ici" : "Ajouter un repas"}
      selected={swapFrom !== null && cellId(swapFrom) === cellId(cell)}
      compact={compact}
      swapped={swapped.includes(id)}
      onOpen={() => {
        onCell(cell);
      }}
      // Repas-recette visible : toucher ouvre la recette, sauf pendant un echange [D204].
      {...(meal?.recipe && !swapFrom
        ? {
            href: `/s/${spaceId}/recipes/${meal.recipe.id}`,
            onMenu: () => {
              onMenu(cell);
            },
          }
        : {})}
      // Une case vide recoit un repas mais ne se prend pas.
      dropId={drag ? id : undefined}
      dragSource={
        drag && kind !== "empty"
          ? drag.source(id, {
              onMenu: () => {
                onMenu(cell);
              },
            })
          : undefined
      }
    />
  );
}

function DayHead({ iso, today, className }: { iso: string; today: string; className?: string }) {
  const { day, num } = shortDay(iso);
  return (
    <span
      className={cx(
        "flex flex-col rounded-md px-2 py-1",
        className,
        iso === today ? "bg-accent-soft text-accent-text" : "text-ink-muted"
      )}
      {...(iso === today ? { "aria-current": "date" as const } : {})}
    >
      <b className="text-xs tracking-wide">{day}</b>
      <span className={cx("text-lg font-bold", iso !== today && "text-ink")}>{num}</span>
    </span>
  );
}

/** Bureau : grille jours x repas. */
function WeekGrid(props: CalendarProps) {
  const { days, mealTimes, today } = props;
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1.5 p-2">
        <span />
        {days.map((iso) => (
          <DayHead key={iso} iso={iso} today={today} />
        ))}
        {mealTimes.map((mealTime) => (
          <div key={mealTime} className="contents">
            <span className="self-center text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {MEAL_TIME_LABELS[mealTime]}
            </span>
            {days.map((date) => (
              <Cell key={date} cell={{ date, mealTime }} props={props} compact />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mobile, vue Jour : bandeau des 7 jours et repas du jour choisi. */
function DayView({
  day,
  onDay,
  ...props
}: CalendarProps & { day: string; onDay: (iso: string) => void }) {
  const { days, mealTimes, today } = props;
  return (
    <div className="fm-stack">
      <div className="grid grid-cols-7 gap-1">
        {days.map((iso) => {
          const { day: short, num } = shortDay(iso);
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={iso === day}
              {...(iso === today ? { "aria-current": "date" as const } : {})}
              className={cx(
                "flex flex-col items-center rounded-md py-1",
                iso === day ? "bg-accent text-on-accent" : "bg-surface"
              )}
              onClick={() => {
                onDay(iso);
              }}
            >
              <span className="text-[11px] font-bold tracking-wide">{short}</span>{" "}
              <span className="text-base font-bold">{num}</span>
            </button>
          );
        })}
      </div>
      <h2 className="m-0 font-display text-xl font-semibold">{dayLabel(day)}</h2>
      {mealTimes.map((mealTime) => (
        <div key={mealTime} className="fm-stack gap-1">
          <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {MEAL_TIME_LABELS[mealTime]}
          </span>
          <Cell cell={{ date: day, mealTime }} props={props} />
        </div>
      ))}
    </div>
  );
}

/** Mobile, vue Semaine : une ligne par jour, repas en pastilles. */
function WeekList(props: CalendarProps) {
  const { days, mealTimes, today } = props;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised">
      {days.map((date) => (
        <div key={date} className="flex items-start gap-3 border-b border-line px-3 py-2.5">
          <DayHead iso={date} today={today} className="w-12 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {mealTimes.map((mealTime) => (
              <Cell key={mealTime} cell={{ date, mealTime }} props={props} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanningPage() {
  const { spaceId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery(WIDE);
  const queryClient = useQueryClient();
  const toast = useToast();
  const space = useQuery(spaceQuery(spaceId));
  const settings = useQuery(settingsQuery(spaceId));
  const today = todayIso();
  const startsOn = settings.data?.weekStartsOn ?? "MON";
  const day = params.get("day") ?? today;
  const start = weekStart(day, startsOn);
  const days = weekDays(start);
  const meals = useQuery({
    ...mealsQuery(spaceId, start, days[6] ?? start),
    enabled: !!settings.data,
  });
  const [view, setView] = useState<"day" | "week">("day");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useUrlFlag("generate", settings.data?.can.manage);
  const [open, setOpen] = useState<MealCell | null>(null);
  const [swapFrom, setSwapFrom] = useState<MealCell | null>(null);

  const goTo = (iso: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (iso === today) next.delete("day");
        else next.set("day", iso);
        return next;
      },
      { replace: true }
    );
  };

  const [swapped, setSwapped] = useState<string[]>([]);
  useEffect(() => {
    if (swapped.length === 0) return;
    const timer = setTimeout(() => {
      setSwapped([]);
    }, 600);
    return () => {
      clearTimeout(timer);
    };
  }, [swapped]);

  const swap = useMutation({
    mutationFn: ({ a, b }: { a: MealCell; b: MealCell }) =>
      api.post(`/spaces/${spaceId}/meal-plan/meals/swap`, { a, b }),
    // Echange affiche tout de suite ; la relecture corrige en cas de refus.
    onMutate: async ({ a, b }) => {
      await queryClient.cancelQueries({ queryKey: mealsKey(spaceId) });
      const [idA, idB] = [cellId(a), cellId(b)];
      queryClient.setQueriesData<Meal[]>({ queryKey: mealsKey(spaceId) }, (list) =>
        list?.map((meal) => {
          const at = cellId(meal);
          if (at === idA) return { ...meal, date: b.date, mealTime: b.mealTime };
          if (at === idB) return { ...meal, date: a.date, mealTime: a.mealTime };
          return meal;
        })
      );
      setSwapped([idA, idB]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealsKey(spaceId) }),
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });

  const drag = usePointerDrag({
    onDrop: (a, b) => {
      swap.mutate({ a: parseCell(a), b: parseCell(b) });
    },
  });

  const byCell = new Map((meals.data ?? []).map((meal) => [cellId(meal), meal]));
  const onCell = (cell: MealCell) => {
    if (swapFrom) {
      if (cellId(swapFrom) !== cellId(cell)) swap.mutate({ a: swapFrom, b: cell });
      setSwapFrom(null);
      return;
    }
    setOpen(cell);
  };

  let content;
  if (settings.isError || meals.isError) {
    const error = settings.error ?? meals.error;
    content = (
      <EmptyState
        icon="triangle-alert"
        title="Impossible de charger le planning"
        action={
          <Button onClick={() => void Promise.all([settings.refetch(), meals.refetch()])}>
            Réessayer
          </Button>
        }
      >
        {errorMessage(error)}
      </EmptyState>
    );
  } else if (!settings.data || !meals.data) {
    content = <Skeleton kind="card" count={2} label="Chargement du planning…" />;
  } else {
    const props: CalendarProps = {
      days,
      mealTimes: settings.data.mealTimes,
      meals: byCell,
      settings: settings.data,
      swapFrom,
      onCell,
      onMenu: setOpen,
      spaceId,
      drag: settings.data.can.edit && !swapFrom ? drag : null,
      swapped,
      today,
    };
    // Mobile : tirer vers le bas relit la semaine affichee [D186].
    content = wide ? (
      <WeekGrid {...props} />
    ) : (
      <PullToRefresh onRefresh={() => meals.refetch()}>
        {view === "day" ? <DayView {...props} day={day} onDay={goTo} /> : <WeekList {...props} />}
      </PullToRefresh>
    );
  }

  const heading = wide
    ? weekLabel(start)
    : view === "day"
      ? null
      : weekLabel(start).replace("Semaine du", "Du");
  const canEdit = settings.data?.can.edit ?? false;
  const swapTitle = swapFrom ? byCell.get(cellId(swapFrom))?.title : null;

  const generateButton = settings.data?.can.manage ? (
    <Button
      variant="primary"
      size="sm"
      icon="sparkles"
      onClick={() => {
        setGenerateOpen(true);
      }}
    >
      Générer
    </Button>
  ) : null;

  return (
    <div className="fm-stack mx-auto w-full max-w-6xl p-4">
      <h1 className="sr-only">Planning</h1>
      {wide ? null : (
        // Mobile : la vue et "Generer" en haut, la navigation et les icones dessous.
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SegmentedControl
              label="Vue du planning"
              options={[
                { value: "day", label: "Jour" },
                { value: "week", label: "Semaine" },
              ]}
              value={view}
              onChange={setView}
            />
          </div>
          {generateButton}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 lg:gap-2">
        <IconButton
          icon="chevron-right"
          label="Semaine précédente"
          className="-scale-x-100"
          onClick={() => {
            goTo(addDays(day, -7));
          }}
        />
        <IconButton
          icon="chevron-right"
          label="Semaine suivante"
          onClick={() => {
            goTo(addDays(day, 7));
          }}
        />
        {wide ? (
          <h2 className="m-0 flex-1 font-display text-xl font-bold xl:text-2xl">{heading}</h2>
        ) : (
          <span className="flex-1" />
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={days.includes(today) && day === today}
          onClick={() => {
            goTo(today);
          }}
        >
          Aujourd'hui
        </Button>
        <Link to="ideas" className="fm-iconbtn" aria-label="Idées de repas" title="Idées de repas">
          <Icon name="lightbulb" />
        </Link>
        {settings.data?.can.manage ? (
          <Link
            to="profiles"
            className="fm-iconbtn"
            aria-label="Profils de génération"
            title="Profils de génération"
          >
            <Icon name="puzzle" />
          </Link>
        ) : null}
        {settings.data?.can.manage ? (
          <IconButton
            icon="settings"
            label="Réglages du planning"
            onClick={() => {
              setSettingsOpen(true);
            }}
          />
        ) : null}
        {wide ? generateButton : null}
      </div>
      {!wide && heading ? <h2 className="m-0 font-display text-xl font-bold">{heading}</h2> : null}
      {swapFrom ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-accent-text"
        >
          <span className="flex-1 text-sm">
            Touche le repas qui prend la place de « {swapTitle ?? "ce repas"} », sur n'importe quel
            jour.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSwapFrom(null);
            }}
          >
            Annuler
          </Button>
        </div>
      ) : null}
      {settings.data && !canEdit ? (
        <p className="m-0 text-sm text-ink-muted">{READ_ONLY_NOTE[settings.data.editRole]}</p>
      ) : null}
      {content}
      {canEdit ? (
        <p className="m-0 text-sm text-ink-muted">
          {wide
            ? "Glisse un repas sur un autre pour les échanger."
            : "Appui long sur un repas, puis glisse-le sur un autre pour les échanger."}{" "}
          Les repas verrouillés ne bougent pas à la génération.
        </p>
      ) : null}
      {settings.data && open ? (
        <MealSheet
          open
          onClose={() => {
            setOpen(null);
          }}
          canEdit={canEdit}
          spaceId={spaceId}
          spaceName={space.data?.name ?? ""}
          cell={open}
          meal={byCell.get(cellId(open)) ?? null}
          defaultServings={settings.data.defaultServings}
          onSwap={() => {
            setSwapFrom(open);
            setOpen(null);
          }}
        />
      ) : null}
      {settings.data?.can.manage ? (
        <GenerateSheet
          open={generateOpen}
          onClose={() => {
            setGenerateOpen(false);
          }}
          spaceId={spaceId}
          weekStart={start}
        />
      ) : null}
      {settings.data ? (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
          }}
          spaceId={spaceId}
          settings={settings.data}
          personal={space.data?.kind === "PERSONAL"}
        />
      ) : null}
    </div>
  );
}
