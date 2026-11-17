// A05 : ingredients. Les nouveaux sont deja utilisables dans les recettes [D09] ;
// ici on les verifie, on les traduit [D34], on leur donne un rayon [D125], une
// unite par defaut et le poids de leurs pieces [D46], et on fusionne les doublons
// (A05b, D120). L'onglet est dans l'adresse (?tab=NO_AISLE depuis les rayons).
import {
  ADMIN_INGREDIENT_TABS,
  INGREDIENT_NAME_MAX,
  adminIngredientSchema,
  type AdminAisle,
  type AdminIngredient,
  type AdminIngredientTab,
  type AdminUnit,
  type UpdateAdminIngredientBody,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useSearchParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { Button } from "../../ui/button.tsx";
import { Chip, RadioGroup } from "../../ui/controls.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { agoLabel, parseDecimal } from "./format.ts";
import {
  adminAislesQuery,
  adminIngredientQuery,
  adminIngredientsQuery,
  adminUnitsQuery,
  refreshIngredients,
} from "./referential-queries.ts";
import { TranslatedNameSheet } from "./translated-name-sheet.tsx";

const TAB_LABELS: Record<AdminIngredientTab, string> = {
  NEW: "Nouveaux",
  VERIFIED: "Vérifiés",
  UNTRANSLATED: "Sans traduction",
  NO_AISLE: "Sans rayon",
};

function isTab(value: string | null): value is AdminIngredientTab {
  return (ADMIN_INGREDIENT_TABS as readonly string[]).includes(value ?? "");
}

function recipes(count: number) {
  return plural(count, "recette", "recettes");
}

function statusLabel(status: AdminIngredient["status"]) {
  return status === "ACTIVE" ? "vérifié" : status === "NEW" ? "nouveau" : "fusionné";
}

/** "7 recettes · Fruits et legumes · cherry tomato" (annonce de la fusion). */
function summary(ingredient: AdminIngredient, aisles: AdminAisle[]) {
  const aisle = aisles.find((a) => a.id === ingredient.aisleId)?.fr ?? "pas de rayon";
  return `${recipes(ingredient.recipeCount)} · ${aisle} · ${ingredient.en?.name ?? "pas d'anglais"}`;
}

// --- Fusion (A05b) ---

function MergeSheet({
  source,
  open,
  onClose,
  onMerged,
}: {
  source: AdminIngredient;
  open: boolean;
  onClose: () => void;
  onMerged: (targetId: string) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const aisles = useQuery(adminAislesQuery).data?.data ?? [];
  const [search, setSearch] = useState("");
  const [intoId, setIntoId] = useState(source.duplicateOfId ?? source.similar[0]?.id ?? "");
  const found = useQuery({
    ...adminIngredientsQuery(undefined, search.trim()),
    enabled: open && search.trim().length > 0,
  });
  const options = [
    ...source.similar.map((s) => ({ id: s.id, name: s.name, status: s.status })),
    ...(found.data?.data ?? []).map((i) => ({ id: i.id, name: i.name, status: i.status })),
  ].filter((o, index, all) => o.id !== source.id && all.findIndex((x) => x.id === o.id) === index);
  const target = useQuery({ ...adminIngredientQuery(intoId), enabled: open && intoId !== "" });
  const merge = useMutation({
    mutationFn: () =>
      api.post(`/admin/ingredients/${source.id}/merge`, { intoId }, adminIngredientSchema),
    onSuccess: async (into) => {
      toast(`« ${source.fr.name} » fusionné dans « ${into.fr.name} »`, { tone: "success" });
      onMerged(into.id);
      onClose();
      await refreshIngredients(queryClient);
    },
  });
  const into = target.data;
  const recipeSentence = !into
    ? null
    : source.recipeCount === 0
      ? "Aucune recette ne l'utilise."
      : source.recipeCount === 1 && source.recipes[0]
        ? `La recette « ${source.recipes[0].title} » de ${source.recipes[0].author} utilisera « ${into.fr.name} ». Les quantités ne changent pas.`
        : `Ses ${recipes(source.recipeCount)} utiliseront « ${into.fr.name} ». Les quantités ne changent pas.`;
  return (
    <Sheet open={open} onClose={onClose} title={`Fusionner « ${source.fr.name} »`}>
      <div className="fm-stack">
        <FormAlert message={merge.error ? errorMessage(merge.error) : undefined} />
        {options.length > 0 ? (
          <RadioGroup
            label="Fusionner dans"
            options={options.map((o) => ({
              value: o.id,
              label: `${o.name} (${statusLabel(o.status)})`,
            }))}
            value={intoId}
            onChange={setIntoId}
          />
        ) : null}
        <Field
          label="Chercher un autre ingrédient"
          value={search}
          autoComplete="off"
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        {into ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-md bg-danger-soft px-4 py-3">
                <span className="text-sm text-ink-muted">Disparaît</span>
                <b>{source.fr.name}</b>
                <span className="text-sm">{summary(source, aisles)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-success-soft px-4 py-3">
                <span className="text-sm text-ink-muted">Reste</span>
                <b>{into.fr.name}</b>
                <span className="text-sm">{summary(into, aisles)}</span>
              </div>
            </div>
            <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
              <li>{recipeSentence}</li>
              <li>
                « {source.fr.name} » devient un synonyme : la saisie le proposera encore et le
                remplacera.
              </li>
              <li>
                Personne n&apos;est notifié ; l&apos;opération est enregistrée dans le journal
                d&apos;audit.
              </li>
            </ul>
          </>
        ) : null}
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!into || merge.isPending}
            onClick={() => {
              merge.mutate();
            }}
          >
            Fusionner
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

// --- Detail ---

function Select({
  label,
  value,
  empty,
  options,
  onChange,
}: {
  label: string;
  value: string;
  empty: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="fm-field">
      <label htmlFor={id} className="fm-label">
        {label}
      </label>
      <select
        id={id}
        className="fm-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function IngredientForm({
  ingredient,
  units,
  aisles,
  onMerged,
}: {
  ingredient: AdminIngredient;
  units: AdminUnit[];
  aisles: AdminAisle[];
  onMerged: (targetId: string) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const counts = units.filter((u) => u.dimension === "COUNT");
  const [names, setNames] = useState({
    fr: ingredient.fr.name,
    frPlural: ingredient.fr.namePlural ?? "",
    en: ingredient.en?.name ?? "",
    enPlural: ingredient.en?.namePlural ?? "",
  });
  const [aisleId, setAisleId] = useState(ingredient.aisleId ?? "");
  const [defaultUnitId, setDefaultUnitId] = useState(ingredient.defaultUnitId ?? "");
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(ingredient.unitWeights.map((w) => [w.unitId, String(w.grams)]))
  );
  const [merging, setMerging] = useState(false);
  const save = useMutation({
    mutationFn: (verify: boolean) => {
      const body: UpdateAdminIngredientBody = {
        fr: { name: names.fr.trim(), namePlural: names.frPlural.trim() || null },
        en: names.en.trim()
          ? { name: names.en.trim(), namePlural: names.enPlural.trim() || null }
          : null,
        aisleId: aisleId || null,
        defaultUnitId: defaultUnitId || null,
        unitWeights: counts.flatMap((unit) => {
          const grams = parseDecimal(weights[unit.id] ?? "");
          return grams !== null && grams > 0 ? [{ unitId: unit.id, grams }] : [];
        }),
        verify,
      };
      return api.put(`/admin/ingredients/${ingredient.id}`, body, adminIngredientSchema);
    },
    onSuccess: async (saved, verify) => {
      toast(verify ? `« ${saved.fr.name} » vérifié` : `« ${saved.fr.name} » enregistré`, {
        tone: "success",
      });
      queryClient.setQueryData(adminIngredientQuery(saved.id).queryKey, saved);
      await refreshIngredients(queryClient);
    },
  });
  const duplicate = ingredient.similar.find((s) => s.id === ingredient.duplicateOfId);
  const mergeButton = (
    <Button
      onClick={() => {
        setMerging(true);
      }}
    >
      Fusionner…
    </Button>
  );
  const setName = (key: keyof typeof names) => (event: { target: { value: string } }) => {
    setNames({ ...names, [key]: event.target.value });
  };
  return (
    <>
      {duplicate ? (
        <div
          role="note"
          className="flex flex-wrap items-center gap-3 rounded-md bg-warning-soft px-4 py-3"
        >
          <span className="flex-[1_1_240px] text-sm">
            <b>Doublon probable</b> de « {duplicate.name} » ({statusLabel(duplicate.status)},{" "}
            {recipes(duplicate.recipeCount)}).
          </span>
          {mergeButton}
        </div>
      ) : null}
      {ingredient.synonyms.length > 0 ? (
        <p className="m-0 text-sm text-ink-muted">Synonymes : {ingredient.synonyms.join(", ")}</p>
      ) : null}
      <FormAlert message={save.error ? errorMessage(save.error) : undefined} />
      <fieldset className="m-0 grid grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Noms par langue</legend>
        <Field
          label="Français (singulier)"
          value={names.fr}
          maxLength={INGREDIENT_NAME_MAX}
          onChange={setName("fr")}
        />
        <Field
          label="Français (pluriel)"
          value={names.frPlural}
          maxLength={INGREDIENT_NAME_MAX}
          onChange={setName("frPlural")}
        />
        <Field
          label="Anglais (singulier)"
          value={names.en}
          maxLength={INGREDIENT_NAME_MAX}
          hint={names.en.trim() ? undefined : "Manquant"}
          onChange={setName("en")}
        />
        <Field
          label="Anglais (pluriel)"
          value={names.enPlural}
          maxLength={INGREDIENT_NAME_MAX}
          onChange={setName("enPlural")}
        />
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Rayon"
          value={aisleId}
          empty="Aucun rayon"
          options={aisles.map((a) => ({ value: a.id, label: a.fr }))}
          onChange={setAisleId}
        />
        <Select
          label="Unité par défaut"
          value={defaultUnitId}
          empty="Aucune"
          options={units.map((u) => ({ value: u.id, label: u.fr.abbreviation }))}
          onChange={setDefaultUnitId}
        />
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="text-sm font-semibold">Poids par unité</legend>
        <p className="m-0 text-sm text-ink-muted">
          Sert à additionner « 12 pièces » et « 200 g » dans une liste de courses. Vide : pas de
          poids connu.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {counts.map((unit) => (
            <Field
              key={unit.id}
              label={`Poids de 1 ${unit.fr.name} (g)`}
              inputMode="decimal"
              value={weights[unit.id] ?? ""}
              onChange={(event) => {
                setWeights({ ...weights, [unit.id]: event.target.value });
              }}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {duplicate ? null : mergeButton}
        <Button
          disabled={save.isPending}
          onClick={() => {
            save.mutate(false);
          }}
        >
          Enregistrer
        </Button>
        {ingredient.status === "NEW" ? (
          <Button
            variant="primary"
            icon="check"
            disabled={save.isPending}
            onClick={() => {
              save.mutate(true);
            }}
          >
            Marquer comme vérifié
          </Button>
        ) : null}
      </div>
      <MergeSheet
        source={ingredient}
        open={merging}
        onClose={() => {
          setMerging(false);
        }}
        onMerged={onMerged}
      />
    </>
  );
}

function IngredientDetail({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  const ingredient = useQuery(adminIngredientQuery(id));
  const units = useQuery(adminUnitsQuery);
  const aisles = useQuery(adminAislesQuery);
  const titleId = useId();
  if (ingredient.isError) return <FormAlert message={errorMessage(ingredient.error)} />;
  if (!ingredient.data || !units.data || !aisles.data) {
    return <Skeleton label="Chargement de l'ingrédient" />;
  }
  const data = ingredient.data;
  const origin = data.createdBy
    ? `Créé par ${data.createdBy} ${agoLabel(data.createdAt)}`
    : "Ajouté par l'administration";
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-[1_1_460px] flex-col gap-4 self-start rounded-lg border border-line bg-surface-raised p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h2 id={titleId} className="m-0 font-display text-xl font-bold">
            {data.fr.name}
          </h2>
          <span className="text-sm text-ink-muted">
            {origin} · utilisé dans {recipes(data.recipeCount)}
          </span>
        </div>
        {data.status === "NEW" ? (
          <Badge tone="accent">Nouveau</Badge>
        ) : (
          <Badge tone="success">Vérifié</Badge>
        )}
      </div>
      <IngredientForm
        key={data.id}
        ingredient={data}
        units={units.data}
        aisles={aisles.data.data}
        onMerged={onSelect}
      />
    </section>
  );
}

// --- Page ---

export function IngredientsPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: AdminIngredientTab = isTab(tabParam) ? tabParam : "NEW";
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = useQuery(adminIngredientsQuery(tab, search.trim()));

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h1 className="m-0 font-display text-2xl font-bold">Ingrédients</h1>
          <p className="m-0 text-ink-muted">
            Les nouveaux ingrédients sont déjà utilisables dans les recettes. Ici, on les vérifie,
            on les traduit et on fusionne les doublons.
          </p>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setAdding(true);
          }}
        >
          Ajouter un ingrédient
        </Button>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label="Liste des ingrédients"
          className="flex min-w-0 flex-[1_1_380px] flex-col gap-3"
        >
          <div className="flex flex-wrap gap-2">
            {ADMIN_INGREDIENT_TABS.map((value) => (
              <Chip
                key={value}
                selected={value === tab}
                onToggle={() => {
                  setParams(value === "NEW" ? {} : { tab: value }, { replace: true });
                }}
              >
                {TAB_LABELS[value]}
                {list.data ? ` (${String(list.data.counts[value])})` : ""}
              </Chip>
            ))}
          </div>
          <Field
            label="Rechercher un ingrédient"
            placeholder="Nom en français ou en anglais"
            value={search}
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          {list.isPending ? (
            <Skeleton kind="row" count={4} label="Chargement des ingrédients" />
          ) : list.isError ? (
            <FormAlert message={errorMessage(list.error)} />
          ) : list.data.data.length === 0 ? (
            <p className="m-0 text-ink-muted">Aucun ingrédient dans cette liste.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line bg-surface-raised p-0">
              {list.data.data.map((item) => (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    aria-pressed={item.id === selectedId}
                    className={`flex min-h-14 w-full items-center gap-2.5 px-4 py-3 text-left ${
                      item.id === selectedId ? "bg-accent-soft" : "hover:bg-surface"
                    }`}
                    onClick={() => {
                      setSelectedId(item.id);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b>{item.name}</b>
                      <span className="text-sm text-ink-muted">
                        {item.createdBy ? `par ${item.createdBy}, ` : ""}
                        {agoLabel(item.createdAt)} · {recipes(item.recipeCount)}
                      </span>
                    </span>
                    {item.probableDuplicate ? <Badge tone="warning">Doublon probable</Badge> : null}
                    {item.status === "NEW" ? <Badge tone="accent">Nouveau</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.data && list.data.total > list.data.data.length ? (
            <p className="m-0 text-sm text-ink-muted">
              {list.data.data.length} sur {list.data.total} : affine la recherche.
            </p>
          ) : null}
        </section>
        {selectedId ? (
          <IngredientDetail key={selectedId} id={selectedId} onSelect={setSelectedId} />
        ) : (
          <p className="m-0 flex-[1_1_460px] self-center text-center text-ink-muted">
            Choisis un ingrédient dans la liste pour le vérifier.
          </p>
        )}
      </div>
      <TranslatedNameSheet
        open={adding}
        title="Ajouter un ingrédient"
        submitLabel="Ajouter"
        description="Il est ajouté comme vérifié."
        maxLength={INGREDIENT_NAME_MAX}
        onClose={() => {
          setAdding(false);
        }}
        onSubmit={async ({ fr, en }) => {
          const created = await api.post(
            "/admin/ingredients",
            { fr: { name: fr }, en: en ? { name: en } : null },
            adminIngredientSchema
          );
          toast(`« ${created.fr.name} » ajouté`, { tone: "success" });
          await refreshIngredients(queryClient);
          setParams({ tab: "VERIFIED" }, { replace: true });
          setSelectedId(created.id);
        }}
      />
    </>
  );
}
