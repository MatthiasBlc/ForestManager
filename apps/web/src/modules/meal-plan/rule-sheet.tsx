// Regle d'un profil de generation [D184] : sur un tag (global ou de l'espace) ou
// une recette visible ; repas concerne ; poids en cinq paliers, ou "Reglage fin"
// de 0 a 200 % par pas de 5 % ; pour un tag, frequence et delai entre deux.
import {
  MAX_COOLDOWN_DAYS,
  MAX_FREQUENCY,
  WEIGHT_STEPS,
  pageSchema,
  recipeSummarySchema,
  ruleSchema,
  type FrequencyPer,
  type MealTime,
  type Rule,
  type RuleBody,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { Chip, SegmentedControl, Stepper, Switch } from "../../ui/controls.tsx";
import { OptionList } from "../../ui/option-list.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { globalTagsQuery, spaceTagsQuery } from "../recipes/queries.ts";
import { useDebounced } from "../../lib/use-debounced.ts";
import { WEIGHT_STEP_LABELS } from "./format.ts";
import { profilesKey } from "./queries.ts";

type TargetKind = "TAG" | "RECIPE";
type MealChoice = "ALL" | MealTime;

const isStep = (weight: number) => (WEIGHT_STEPS as readonly number[]).includes(weight);

/** Choix d'un tag (global ou de l'espace) en pastilles : reste court meme avec beaucoup de tags. */
export function TagChoice({
  spaceId,
  value,
  onChange,
  label = "Tag",
}: {
  spaceId: string;
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
}) {
  const global = useQuery(globalTagsQuery);
  const local = useQuery(spaceTagsQuery(spaceId));
  const tags = [...(global.data ?? []), ...(local.data ?? [])];
  if (!global.data || !local.data) return <p className="m-0 text-sm text-ink-muted">Chargement…</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {tags.map((tag) => (
        <Chip
          key={tag.id}
          selected={tag.id === value}
          onToggle={() => {
            onChange(tag.id);
          }}
        >
          {tag.name}
        </Chip>
      ))}
    </div>
  );
}

function RecipeChoice({
  spaceId,
  value,
  onChange,
}: {
  spaceId: string;
  value: { id: string; title: string } | null;
  onChange: (recipe: { id: string; title: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const found = useQuery({
    queryKey: ["spaces", spaceId, "meal-plan", "rule-search", q],
    queryFn: () =>
      api.get(
        `/spaces/${spaceId}/recipes?q=${encodeURIComponent(q)}`,
        pageSchema(recipeSummarySchema)
      ),
    enabled: q.length > 0,
  });
  const results = (found.data?.data ?? []).map((r) => ({ id: r.id, title: r.title }));
  const shown = value && !results.some((r) => r.id === value.id) ? [value, ...results] : results;
  return (
    <div className="fm-stack">
      <label className="fm-label" htmlFor="rule-recipe-search">
        Recette
      </label>
      <input
        id="rule-recipe-search"
        type="search"
        className="fm-input"
        placeholder="Rechercher une recette de l'espace"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      {shown.length > 0 ? (
        <OptionList
          label="Recettes trouvées"
          options={shown.map((r) => ({ value: r.id, label: r.title, icon: "book-open" }))}
          value={value?.id ?? null}
          onChange={(id) => {
            const picked = shown.find((r) => r.id === id);
            if (picked) onChange(picked);
          }}
        />
      ) : q && !found.isFetching ? (
        <p className="m-0 text-sm text-ink-muted">Aucune recette ne correspond.</p>
      ) : null}
    </div>
  );
}

/** 0 = libre ; sinon une borne de 1 a MAX_FREQUENCY. */
const freeLabel = (value: number) => (value === 0 ? "Libre" : String(value));

function RuleForm({
  spaceId,
  profileId,
  rule,
  onDone,
}: {
  spaceId: string;
  profileId: string;
  rule: Rule | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const guard = useWriteGuard();
  const [kind, setKind] = useState<TargetKind>(rule?.target.kind ?? "TAG");
  const [tagId, setTagId] = useState<string | null>(
    rule?.target.kind === "TAG" && rule.target.tag.status === "ACTIVE" ? rule.target.tag.id : null
  );
  const [recipe, setRecipe] = useState<{ id: string; title: string } | null>(
    rule?.target.kind === "RECIPE" && rule.target.recipe.title
      ? { id: rule.target.recipe.id, title: rule.target.recipe.title }
      : null
  );
  const [meal, setMeal] = useState<MealChoice>(rule?.mealTime ?? "ALL");
  const [weight, setWeight] = useState(rule?.weight ?? 1);
  const [fine, setFine] = useState(rule ? !isStep(rule.weight) : false);
  const [min, setMin] = useState(rule?.frequencyMin ?? 0);
  const [max, setMax] = useState(rule?.frequencyMax ?? 0);
  const [per, setPer] = useState<FrequencyPer>(rule?.frequencyPer ?? "PER_WEEK");
  const [cooldown, setCooldown] = useState(rule?.tagCooldownDays ?? 0);
  const [problem, setProblem] = useState<string>();
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: profilesKey(spaceId) });
    onDone();
  };

  const base = `/spaces/${spaceId}/meal-plan/profiles/${profileId}/rules`;
  const save = useMutation({
    mutationFn: (body: RuleBody) =>
      rule ? api.put(`${base}/${rule.id}`, body, ruleSchema) : api.post(base, body, ruleSchema),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`${base}/${rule?.id ?? ""}`),
    onSuccess: done,
  });

  const submit = () => {
    const target =
      kind === "TAG"
        ? tagId && { kind: "TAG" as const, tagId }
        : recipe && { kind: "RECIPE" as const, recipeId: recipe.id };
    if (!target) {
      setProblem(kind === "TAG" ? "Choisis un tag." : "Choisis une recette.");
      return;
    }
    if (kind === "TAG" && min > 0 && max > 0 && min > max) {
      setProblem("Le minimum dépasse le maximum.");
      return;
    }
    setProblem(undefined);
    const tag = kind === "TAG";
    save.mutate({
      target,
      weight,
      mealTime: meal === "ALL" ? null : meal,
      frequencyMin: tag && min > 0 ? min : null,
      frequencyMax: tag && max > 0 ? max : null,
      frequencyPer: tag && (min > 0 || max > 0) ? per : null,
      tagCooldownDays: tag && cooldown > 0 ? cooldown : null,
    });
  };

  const failure = save.error ?? remove.error;
  return (
    <div className="fm-stack">
      <FormAlert message={problem ?? (failure ? errorMessage(failure) : undefined)} />
      <SegmentedControl
        label="La règle porte sur"
        options={[
          { value: "TAG", label: "Un tag" },
          { value: "RECIPE", label: "Une recette" },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "TAG" ? (
        <TagChoice spaceId={spaceId} value={tagId} onChange={setTagId} />
      ) : (
        <RecipeChoice spaceId={spaceId} value={recipe} onChange={setRecipe} />
      )}
      <div className="flex flex-col gap-1">
        <span className="fm-label">Repas</span>
        <SegmentedControl
          label="Repas concerné"
          options={[
            { value: "ALL", label: "Tous" },
            { value: "LUNCH", label: "Midi" },
            { value: "DINNER", label: "Soir" },
          ]}
          value={meal}
          onChange={setMeal}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="fm-label">Poids</span>
        {fine ? (
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Poids"
              className="flex-1"
              min={0}
              max={200}
              step={5}
              value={Math.round(weight * 100)}
              onChange={(event) => {
                setWeight(Number(event.target.value) / 100);
              }}
            />
            <output className="min-w-14 text-right font-mono text-sm">
              {Math.round(weight * 100)} %
            </output>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Paliers de poids">
            {WEIGHT_STEPS.map((step) => (
              <Chip
                key={step}
                selected={weight === step}
                onToggle={() => {
                  setWeight(step);
                }}
              >
                {WEIGHT_STEP_LABELS[step]}
              </Chip>
            ))}
          </div>
        )}
        <Switch
          label="Réglage fin"
          checked={fine}
          onChange={(on) => {
            setFine(on);
            // Retour aux paliers : le plus proche.
            if (!on && !isStep(weight)) {
              setWeight(
                WEIGHT_STEPS.reduce((best, step) =>
                  Math.abs(step - weight) < Math.abs(best - weight) ? step : best
                )
              );
            }
          }}
        />
      </div>
      {kind === "TAG" ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="fm-label">Fréquence</span>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Au moins</span>
                <Stepper
                  label="Au moins"
                  min={0}
                  max={MAX_FREQUENCY}
                  value={min}
                  format={freeLabel}
                  onChange={setMin}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Au plus</span>
                <Stepper
                  label="Au plus"
                  min={0}
                  max={MAX_FREQUENCY}
                  value={max}
                  format={freeLabel}
                  onChange={setMax}
                />
              </div>
            </div>
            {min > 0 || max > 0 ? (
              <SegmentedControl
                label="Fréquence comptée"
                options={[
                  { value: "PER_WEEK", label: "Par semaine" },
                  { value: "PER_PERIOD", label: "Sur la période" },
                ]}
                value={per}
                onChange={setPer}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="fm-label">Jours entre deux recettes de ce tag</span>
            <Stepper
              label="Jours entre deux recettes de ce tag"
              min={0}
              max={MAX_COOLDOWN_DAYS}
              value={cooldown}
              format={(days) => (days === 0 ? "Aucun" : `${String(days)} j`)}
              onChange={setCooldown}
            />
          </div>
        </>
      ) : null}
      <SheetFooter>
        <Button
          variant="primary"
          block
          disabled={save.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={submit}
        >
          {rule ? "Enregistrer" : "Ajouter la règle"}
        </Button>
        {rule ? (
          <Button
            variant="danger"
            block
            disabled={remove.isPending || guard.disabled}
            onClick={() => {
              remove.mutate();
            }}
          >
            Supprimer la règle
          </Button>
        ) : null}
      </SheetFooter>
    </div>
  );
}

export function RuleSheet({
  open,
  onClose,
  spaceId,
  profileId,
  rule,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  profileId: string;
  rule: Rule | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={rule ? "Modifier la règle" : "Nouvelle règle"}>
      {open ? (
        <RuleForm spaceId={spaceId} profileId={profileId} rule={rule} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}
