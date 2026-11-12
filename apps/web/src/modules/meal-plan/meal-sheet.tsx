// F-REPAS [P10, D181] : recette (espace d'abord, puis mes recettes avec partage
// propose), texte libre ou "Pas de repas" ; portions, commentaire, verrou ; vider,
// echanger. Sans le droit de modifier : le repas en lecture seule (F-MPL-3).
import {
  mealSchema,
  pageSchema,
  recipeSummarySchema,
  shareRequestResultSchema,
  suggestMealResultSchema,
  type Meal,
  type MealCell,
  type MealKind,
  type PutMealBody,
  type RecipeSummary,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { SegmentedControl, Stepper, Switch } from "../../ui/controls.tsx";
import { Field } from "../../ui/field.tsx";
import { OptionList, type OptionItem } from "../../ui/option-list.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { whenLabel } from "./dates.ts";
import { reasonText } from "./format.ts";
import { mealsKey } from "./queries.ts";

const KINDS: readonly { value: MealKind; label: string }[] = [
  { value: "RECIPE", label: "Recette" },
  { value: "TEXT", label: "Texte libre" },
  { value: "SKIPPED", label: "Pas de repas" },
];

const recipePage = pageSchema(recipeSummarySchema);

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

interface Choice {
  id: string;
  title: string;
  /** Une de mes recettes pas encore visible dans l'espace : a partager avant. */
  homeSpaceId: string | null;
}

/** Recettes de l'espace, puis mes recettes d'autres espaces (a y partager). */
function RecipeSearch({
  spaceId,
  spaceName,
  choice,
  onChoose,
}: {
  spaceId: string;
  spaceName: string;
  choice: Choice | null;
  onChoose: (choice: Choice) => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const query = (path: string) => ({
    queryKey: ["spaces", spaceId, "meal-plan", "search", path, q],
    queryFn: () =>
      api.get(`/spaces/${spaceId}/recipes${path}?q=${encodeURIComponent(q)}`, recipePage),
    enabled: q.length > 0,
  });
  const inSpace = useQuery(query(""));
  const mine = useQuery(query("/mine"));

  const spaceIds = new Set((inSpace.data?.data ?? []).map((r) => r.id));
  const found: Choice[] = [
    ...(inSpace.data?.data ?? []).map((r: RecipeSummary) => ({
      id: r.id,
      title: r.title,
      homeSpaceId: null,
    })),
    ...(mine.data?.data ?? [])
      .filter((r) => !spaceIds.has(r.id) && r.homeSpaceId !== spaceId)
      .map((r) => ({ id: r.id, title: r.title, homeSpaceId: r.homeSpaceId })),
  ];
  const shown = choice && !found.some((c) => c.id === choice.id) ? [choice, ...found] : found;
  const options: OptionItem<string>[] = shown.map((c) => ({
    value: c.id,
    label: c.title,
    icon: "book-open",
    ...(c.homeSpaceId ? { hint: `Partagée dans ${spaceName} en l'ajoutant` } : {}),
  }));

  return (
    <div className="fm-stack">
      <label className="fm-label" htmlFor="meal-recipe-search">
        Recette
      </label>
      <input
        id="meal-recipe-search"
        type="search"
        className="fm-input"
        placeholder="Rechercher une recette"
        aria-describedby="meal-recipe-search-hint"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      <span id="meal-recipe-search-hint" className="-mt-2 text-sm text-ink-muted">
        Dans {spaceName} et dans mes recettes.
      </span>
      {options.length > 0 ? (
        <OptionList
          label="Recettes trouvées"
          options={options}
          value={choice?.id ?? null}
          onChange={(id) => {
            const picked = shown.find((c) => c.id === id);
            if (picked) onChoose(picked);
          }}
        />
      ) : q && !inSpace.isFetching && !mine.isFetching ? (
        <p className="m-0 text-sm text-ink-muted">Aucune recette ne correspond.</p>
      ) : null}
    </div>
  );
}

function ReadOnlyMeal({ spaceId, meal }: { spaceId: string; meal: Meal | null }) {
  if (!meal) return <p className="m-0 text-ink-muted">Rien de prévu pour ce repas.</p>;
  return (
    <div className="fm-stack">
      <p className="m-0 font-semibold">{meal.kind === "SKIPPED" ? "Pas de repas" : meal.title}</p>
      {meal.servings ? <p className="m-0 text-sm">{meal.servings} pers.</p> : null}
      {meal.comment ? <p className="m-0">{meal.comment}</p> : null}
      {meal.recipe ? (
        <Link to={`/s/${spaceId}/recipes/${meal.recipe.id}`} className="fm-btn fm-btn-secondary">
          Voir la recette
        </Link>
      ) : null}
    </div>
  );
}

interface FormProps {
  spaceId: string;
  spaceName: string;
  cell: MealCell;
  meal: Meal | null;
  defaultServings: number;
  onDone: () => void;
  onSwap: () => void;
}

function MealForm({ spaceId, spaceName, cell, meal, defaultServings, onDone, onSwap }: FormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const [kind, setKind] = useState<MealKind>(meal?.kind ?? "RECIPE");
  const [choice, setChoice] = useState<Choice | null>(
    meal?.kind === "RECIPE" && meal.recipe && meal.title
      ? { id: meal.recipe.id, title: meal.title, homeSpaceId: null }
      : null
  );
  const [text, setText] = useState(meal?.kind === "TEXT" ? (meal.title ?? "") : "");
  const [servings, setServings] = useState(meal?.servings ?? defaultServings);
  const [comment, setComment] = useState(meal?.comment ?? "");
  const [locked, setLocked] = useState(meal?.locked ?? false);
  const gone = meal?.kind === "RECIPE" && !meal.recipe ? meal.title : null;
  const base = `/spaces/${spaceId}/meal-plan/meals/${cell.date}/${cell.mealTime}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: mealsKey(spaceId) });

  const save = useMutation({
    mutationFn: async () => {
      const extra = {
        comment: comment.trim() || null,
        servings: servings === defaultServings ? null : servings,
        locked,
      };
      let body: PutMealBody;
      if (kind === "SKIPPED") {
        body = { kind: "SKIPPED" };
      } else if (kind === "TEXT") {
        body = { kind: "TEXT", text: text.trim(), ...extra };
      } else {
        if (!choice) throw new Error("no recipe");
        body = { kind: "RECIPE", recipeId: choice.id, ...extra };
        if (choice.homeSpaceId) {
          // Une de mes recettes : la partager dans l'espace, ou demander a son auteur [D81].
          const { status } = await api.post(
            `/spaces/${choice.homeSpaceId}/recipes/${choice.id}/share-requests`,
            { targetSpaceId: spaceId },
            shareRequestResultSchema
          );
          if (status !== "SHARED") {
            body = { kind: "TEXT", text: choice.title, ...extra };
            toast(
              `Demande de partage envoyée à l'auteur ; en attendant, « ${choice.title} » est noté en texte.`
            );
          }
        }
      }
      return api.put(base, body, mealSchema);
    },
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  const clear = useMutation({
    mutationFn: () => api.delete(base),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  // "Proposer un autre repas" : profil par defaut, apres confirmation (D58, droit de modifier).
  const [confirming, setConfirming] = useState(false);
  const suggest = useMutation({
    mutationFn: () => api.post(`${base}/suggest`, undefined, suggestMealResultSchema),
    onSuccess: async (result) => {
      setConfirming(false);
      if (!result.meal) return;
      await refresh();
      toast(`Remplacé par « ${result.meal.title ?? ""} »`, { tone: "success" });
      onDone();
    },
  });
  const nothing = suggest.data && !suggest.data.meal ? suggest.data.reason : null;

  const valid = kind === "SKIPPED" || (kind === "TEXT" ? text.trim() !== "" : choice !== null);
  const error = save.error ?? clear.error ?? suggest.error;

  return (
    <div className="fm-stack">
      <FormAlert message={error ? errorMessage(error) : undefined} />
      <SegmentedControl label="Type de repas" options={KINDS} value={kind} onChange={setKind} />
      {kind === "RECIPE" ? (
        <>
          {gone ? (
            <p role="note" className="m-0 rounded-md bg-warning-soft px-3 py-2 text-sm">
              « {gone} » n'est plus disponible dans {spaceName}. Choisis une autre recette ou
              note-le en texte.
            </p>
          ) : null}
          <RecipeSearch
            spaceId={spaceId}
            spaceName={spaceName}
            choice={choice}
            onChoose={setChoice}
          />
        </>
      ) : null}
      {kind === "TEXT" ? (
        <Field
          label="Repas"
          placeholder="Restes, resto, pique-nique…"
          value={text}
          maxLength={200}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      ) : null}
      {kind !== "SKIPPED" ? (
        <>
          <span className="fm-label">Portions</span>
          <Stepper
            label="Portions"
            min={1}
            max={50}
            unit="pers."
            value={servings}
            onChange={setServings}
          />
          <Field
            label="Commentaire"
            placeholder="Visible en touchant le repas"
            value={comment}
            maxLength={500}
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
          <Switch
            label="Verrouiller : la génération ne le remplace pas"
            checked={locked}
            onChange={setLocked}
          />
        </>
      ) : null}
      {meal ? (
        <Button variant="ghost" icon="refresh" onClick={onSwap} {...guard}>
          Échanger avec un autre repas
        </Button>
      ) : null}
      {meal?.locked ? null : confirming ? (
        <div
          role="group"
          aria-label="Proposer un autre repas"
          className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-accent-text"
        >
          <span className="flex-1 text-sm">
            {meal && meal.kind !== "SKIPPED"
              ? `Remplacer « ${meal.title ?? ""} » par une proposition du profil par défaut ?`
              : "Remplir ce repas avec une proposition du profil par défaut ?"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={suggest.isPending || guard.disabled}
            aria-describedby={guard["aria-describedby"]}
            onClick={() => {
              suggest.mutate();
            }}
          >
            Remplacer
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          icon="sparkles"
          {...guard}
          onClick={() => {
            suggest.reset();
            setConfirming(true);
          }}
        >
          {meal ? "Proposer un autre repas" : "Proposer un repas"}
        </Button>
      )}
      {nothing ? (
        <p role="status" className="m-0 rounded-md bg-warning-soft px-3 py-2 text-sm">
          Rien à proposer : {lowerFirst(reasonText(nothing))}
        </p>
      ) : null}
      <SheetFooter>
        {meal ? (
          <Button
            variant="secondary"
            disabled={clear.isPending || guard.disabled}
            aria-describedby={guard["aria-describedby"]}
            onClick={() => {
              clear.mutate();
            }}
          >
            Vider le repas
          </Button>
        ) : null}
        <Button
          variant="primary"
          disabled={!valid || save.isPending || guard.disabled}
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

export function MealSheet({
  open,
  onClose,
  canEdit,
  ...form
}: Omit<FormProps, "onDone"> & { open: boolean; onClose: () => void; canEdit: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={whenLabel(form.cell.date, form.cell.mealTime)}>
      {/* Remonte a chaque ouverture : le formulaire repart du repas enregistre. */}
      {open ? (
        canEdit ? (
          <MealForm {...form} onDone={onClose} />
        ) : (
          <ReadOnlyMeal spaceId={form.spaceId} meal={form.meal} />
        )
      ) : null}
    </Sheet>
  );
}
