// F-REGLAGES-PLANNING [D11, D58, D180] : repas de la journee, portions par defaut,
// debut de semaine (moderateurs et OWNER) ; role minimal pour modifier un repas (OWNER).
import {
  MEAL_TIMES,
  mealPlanSettingsSchema,
  sortMealTimes,
  type MealPlanSettings,
  type MealTime,
  type SpaceRole,
  type UpdateMealPlanSettingsBody,
  type Weekday,
} from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { Chip, RadioGroup, SegmentedControl, Stepper } from "../../ui/controls.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../../core/access/auth-layout.tsx";
import { EDIT_ROLE_LABELS, MEAL_TIME_LABELS, WEEKDAY_LABELS } from "./format.ts";
import { settingsQuery } from "./queries.ts";

/** Debuts de semaine proposes ; un autre jour deja enregistre reste propose. */
const WEEK_STARTS: readonly Weekday[] = ["MON", "SAT", "SUN"];

const EDIT_ROLES: readonly { value: SpaceRole; label: string; hint: string }[] = [
  { value: "MEMBER", label: EDIT_ROLE_LABELS.MEMBER, hint: "Tout le monde remplit le planning." },
  {
    value: "MODERATOR",
    label: EDIT_ROLE_LABELS.MODERATOR,
    hint: "Les membres consultent seulement.",
  },
  { value: "OWNER", label: EDIT_ROLE_LABELS.OWNER, hint: "Toi seul modifies les repas." },
];

function SettingsForm({
  spaceId,
  settings,
  personal,
  onDone,
}: {
  spaceId: string;
  settings: MealPlanSettings;
  personal: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const [mealTimes, setMealTimes] = useState<MealTime[]>(settings.mealTimes);
  const [servings, setServings] = useState(settings.defaultServings);
  const [weekStartsOn, setWeekStartsOn] = useState<Weekday>(settings.weekStartsOn);
  const [editRole, setEditRole] = useState<SpaceRole>(settings.editRole);
  const starts = WEEK_STARTS.includes(settings.weekStartsOn)
    ? WEEK_STARTS
    : [...WEEK_STARTS, settings.weekStartsOn];

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateMealPlanSettingsBody = {
        mealTimes,
        defaultServings: servings,
        weekStartsOn,
      };
      if (settings.can.setEditRole && editRole !== settings.editRole) body.editRole = editRole;
      return api.put(`/spaces/${spaceId}/meal-plan/settings`, body, mealPlanSettingsSchema);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsQuery(spaceId).queryKey, saved);
      toast("Réglages enregistrés", { tone: "success" });
      onDone();
    },
  });

  const toggle = (time: MealTime, on: boolean) => {
    setMealTimes((times) =>
      on ? sortMealTimes([...times, time]) : times.filter((t) => t !== time)
    );
  };

  return (
    <div className="fm-stack">
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <section className="fm-stack" aria-labelledby="meal-times">
        <span className="fm-label" id="meal-times">
          Repas à planifier
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="meal-times">
          {MEAL_TIMES.map((time) => (
            <Chip
              key={time}
              selected={mealTimes.includes(time)}
              onToggle={(on) => {
                toggle(time, on);
              }}
            >
              {MEAL_TIME_LABELS[time]}
            </Chip>
          ))}
        </div>
        {mealTimes.length === 0 ? (
          <p className="m-0 text-sm text-danger-text" role="alert">
            Choisis au moins un repas.
          </p>
        ) : null}
      </section>
      <span className="fm-label">Portions par repas</span>
      <Stepper
        label="Portions par repas"
        min={1}
        max={50}
        unit="pers."
        value={servings}
        onChange={setServings}
      />
      <p className="m-0 -mt-2 text-sm text-ink-muted">Modifiable repas par repas.</p>
      <span className="fm-label">Début de semaine</span>
      <SegmentedControl
        label="Début de semaine"
        options={starts.map((day) => ({ value: day, label: WEEKDAY_LABELS[day] }))}
        value={weekStartsOn}
        onChange={setWeekStartsOn}
      />
      {personal ? null : settings.can.setEditRole ? (
        <>
          <span className="fm-label">Qui peut modifier les repas</span>
          <RadioGroup
            label="Qui peut modifier les repas"
            options={EDIT_ROLES}
            value={editRole}
            onChange={setEditRole}
          />
        </>
      ) : (
        <div className="fm-stack gap-1">
          <span className="fm-label">Qui peut modifier les repas</span>
          <p className="m-0">{EDIT_ROLE_LABELS[settings.editRole]}</p>
          <p className="m-0 text-sm text-ink-muted">Réglé par le propriétaire de l'espace.</p>
        </div>
      )}
      <SheetFooter>
        <Button
          variant="primary"
          block
          disabled={mealTimes.length === 0 || save.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            save.mutate();
          }}
        >
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

export function SettingsSheet({
  open,
  onClose,
  spaceId,
  settings,
  personal,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  settings: MealPlanSettings;
  personal: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Réglages du planning">
      {/* Remonte a chaque ouverture : le formulaire repart des reglages enregistres. */}
      {open ? (
        <SettingsForm spaceId={spaceId} settings={settings} personal={personal} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}
