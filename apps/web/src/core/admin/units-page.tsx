// A06 : unites et conversions. Masses et volumes se convertissent vers leur base
// (g, ml) ; les pieces passent par le poids de chaque ingredient [D46]. Le testeur
// reprend addQuantities, le calcul de la future liste de courses.
import {
  UNIT_DIMENSIONS,
  addQuantities,
  adminUnitSchema,
  formatQuantity,
  type AdminUnit,
  type UnitDimension,
} from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { SegmentedControl, Switch } from "../../ui/controls.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { parseDecimal } from "./format.ts";
import { adminUnitsQuery } from "./referential-queries.ts";
import { TableScroll } from "../../ui/table-scroll.tsx";

const DIMENSION_LABELS: Record<UnitDimension, string> = {
  MASS: "Masse",
  VOLUME: "Volume",
  COUNT: "Pièces",
  NONE: "Sans quantité",
};
const BASE: Partial<Record<UnitDimension, string>> = { MASS: "g", VOLUME: "ml" };

type Filter = UnitDimension | "ALL";
const FILTERS = [
  { value: "ALL" as Filter, label: "Toutes" },
  ...UNIT_DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABELS[d] })),
];

function baseLabel(unit: AdminUnit): string {
  if (unit.dimension === "COUNT") return "par ingrédient";
  if (unit.toBase === null) return "-";
  if (unit.toBase === 1) return "base";
  return `${formatQuantity(unit.toBase)} ${BASE[unit.dimension] ?? ""}`;
}

/** "3 pièces", "20 ml" : abreviation, ou pluriel quand l'unite s'ecrit en entier. */
function amount(quantity: number | null, unit: AdminUnit): string {
  const plain = unit.fr.abbreviation === unit.fr.name;
  const label =
    plain && quantity !== null && quantity >= 2 && unit.fr.namePlural
      ? unit.fr.namePlural
      : unit.fr.abbreviation;
  return quantity === null ? label : `${formatQuantity(quantity)} ${label}`;
}

// --- Testeur d'addition ---

function UnitSelect({
  label,
  units,
  value,
  onChange,
}: {
  label: string;
  units: AdminUnit[];
  value: string;
  onChange: (id: string) => void;
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
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.fr.abbreviation}
          </option>
        ))}
      </select>
    </div>
  );
}

function AdditionTester({ units }: { units: AdminUnit[] }) {
  const byCode = (code: string) => units.find((u) => u.code === code)?.id ?? units[0]?.id ?? "";
  const [first, setFirst] = useState({ quantity: "3", unitId: byCode("tbsp") });
  const [second, setSecond] = useState({ quantity: "20", unitId: byCode("ml") });
  const [weight, setWeight] = useState("");
  const grams = parseDecimal(weight);
  const lines = [first, second].flatMap((line) => {
    const unit = units.find((u) => u.id === line.unitId);
    return unit ? [{ quantity: parseDecimal(line.quantity), unit }] : [];
  });
  const weights: Record<string, number> = {};
  if (grams !== null && grams > 0) {
    for (const { unit } of lines) if (unit.dimension === "COUNT") weights[unit.code] = grams;
  }
  const result = addQuantities(lines, units, weights) as {
    quantity: number | null;
    unit: AdminUnit;
  }[];
  const explanation = lines
    .map(({ quantity, unit }) => {
      const q = formatQuantity(quantity ?? 0);
      const w = weights[unit.code];
      if (quantity !== null && w !== undefined) return `${q} × ${formatQuantity(w)} g`;
      if (quantity !== null && unit.toBase !== null && unit.toBase !== 1) {
        return `${q} × ${formatQuantity(unit.toBase)} ${BASE[unit.dimension] ?? ""}`;
      }
      return amount(quantity, unit);
    })
    .join(" + ");
  return (
    <aside
      aria-labelledby="tester-title"
      className="flex flex-[1_1_300px] flex-col gap-3 self-start rounded-lg border border-line bg-surface-raised p-5"
    >
      <h2 id="tester-title" className="m-0 font-display text-lg font-bold">
        Tester une addition
      </h2>
      <p className="m-0 text-sm text-ink-muted">
        Comme le fera la liste de courses pour un même ingrédient.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Première quantité"
          inputMode="decimal"
          value={first.quantity}
          onChange={(event) => {
            setFirst({ ...first, quantity: event.target.value });
          }}
        />
        <UnitSelect
          label="Première unité"
          units={units}
          value={first.unitId}
          onChange={(unitId) => {
            setFirst({ ...first, unitId });
          }}
        />
        <Field
          label="Seconde quantité"
          inputMode="decimal"
          value={second.quantity}
          onChange={(event) => {
            setSecond({ ...second, quantity: event.target.value });
          }}
        />
        <UnitSelect
          label="Seconde unité"
          units={units}
          value={second.unitId}
          onChange={(unitId) => {
            setSecond({ ...second, unitId });
          }}
        />
      </div>
      <Field
        label="Poids de 1 pièce (g)"
        hint="Facultatif : le poids que l'ingrédient donne à ses pièces."
        inputMode="decimal"
        value={weight}
        onChange={(event) => {
          setWeight(event.target.value);
        }}
      />
      <div role="status" className="flex flex-col gap-1 rounded-md bg-accent-soft px-4 py-3">
        <span className="text-sm text-ink-muted">Résultat</span>
        <b className="font-mono text-lg">
          {result.map((line) => amount(line.quantity, line.unit)).join(" et ")}
        </b>
        <span className="font-mono text-sm text-ink-muted">{explanation}</span>
      </div>
      <p className="m-0 text-sm text-ink-muted">
        Sans poids connu pour les pièces, la liste garde une ligne par unité.
      </p>
    </aside>
  );
}

// --- Ajout et modification ---

interface Names {
  name: string;
  namePlural: string;
  abbreviation: string;
}

function namesOf(value: AdminUnit["fr"] | null): Names {
  return {
    name: value?.name ?? "",
    namePlural: value?.namePlural ?? "",
    abbreviation: value?.abbreviation ?? "",
  };
}

function UnitForm({ unit, onClose }: { unit: AdminUnit | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const dimensionId = useId();
  const [code, setCode] = useState("");
  const [dimension, setDimension] = useState<UnitDimension>(unit?.dimension ?? "COUNT");
  const [factor, setFactor] = useState(unit?.toBase === null ? "" : String(unit?.toBase ?? ""));
  const [metric, setMetric] = useState(unit?.metric ?? false);
  const [fr, setFr] = useState(namesOf(unit?.fr ?? null));
  const [en, setEn] = useState(namesOf(unit?.en ?? null));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const base = BASE[dimension];

  const submit = async () => {
    const toBase = base ? parseDecimal(factor) : null;
    if (base && (toBase === null || toBase <= 0)) {
      setError(`Indique combien de ${base} vaut une unité.`);
      return;
    }
    if (!fr.name.trim() || !fr.abbreviation.trim() || (!unit && !code.trim())) {
      setError("Le code, le nom et l'abréviation en français sont obligatoires.");
      return;
    }
    const english = en.name.trim()
      ? {
          name: en.name.trim(),
          namePlural: en.namePlural.trim() || null,
          abbreviation: en.abbreviation.trim() || en.name.trim(),
        }
      : null;
    const body = {
      dimension,
      toBase,
      metric: base ? metric : false,
      fr: {
        name: fr.name.trim(),
        namePlural: fr.namePlural.trim() || null,
        abbreviation: fr.abbreviation.trim(),
      },
      en: english,
    };
    setPending(true);
    setError(undefined);
    try {
      await (unit
        ? api.patch(`/admin/units/${unit.id}`, body, adminUnitSchema)
        : api.post("/admin/units", { code: code.trim(), ...body }, adminUnitSchema));
      toast(unit ? `Unité « ${body.fr.abbreviation} » enregistrée` : "Unité ajoutée", {
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: adminUnitsQuery.queryKey });
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const namesFields = (lang: "français" | "anglais", value: Names, set: (v: Names) => void) => (
    <fieldset className="m-0 grid grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-3">
      <legend className="mb-2 text-sm font-semibold">
        {lang === "français" ? "Français" : "Anglais (facultatif)"}
      </legend>
      <Field
        label={`Nom (${lang === "français" ? "fr" : "en"})`}
        value={value.name}
        maxLength={40}
        onChange={(event) => {
          set({ ...value, name: event.target.value });
        }}
      />
      <Field
        label={`Pluriel (${lang === "français" ? "fr" : "en"})`}
        value={value.namePlural}
        maxLength={40}
        onChange={(event) => {
          set({ ...value, namePlural: event.target.value });
        }}
      />
      <Field
        label={`Abréviation (${lang === "français" ? "fr" : "en"})`}
        value={value.abbreviation}
        maxLength={20}
        onChange={(event) => {
          set({ ...value, abbreviation: event.target.value });
        }}
      />
    </fieldset>
  );

  return (
    <form
      className="fm-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormAlert message={error} />
      {unit ? null : (
        <Field
          label="Code"
          hint="Minuscules, chiffres et tirets ; il ne change plus ensuite."
          value={code}
          maxLength={20}
          autoComplete="off"
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="fm-field">
          <label htmlFor={dimensionId} className="fm-label">
            Dimension
          </label>
          <select
            id={dimensionId}
            className="fm-input"
            value={dimension}
            onChange={(event) => {
              setDimension(event.target.value as UnitDimension);
            }}
          >
            {UNIT_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {DIMENSION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        {base ? (
          <Field
            label={`Vers la base (${base})`}
            inputMode="decimal"
            value={factor}
            onChange={(event) => {
              setFactor(event.target.value);
            }}
          />
        ) : null}
      </div>
      {base ? (
        <Switch
          label="Unité métrique, remplaçable par une plus lisible (1 500 g → 1,5 kg)"
          checked={metric}
          onChange={setMetric}
        />
      ) : null}
      {namesFields("français", fr, setFr)}
      {namesFields("anglais", en, setEn)}
      <SheetFooter>
        <Button type="button" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {unit ? "Enregistrer" : "Ajouter"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function UnitsPage() {
  const units = useQuery(adminUnitsQuery);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<{ unit: AdminUnit | null } | null>(null);
  const close = () => {
    setEditing(null);
  };
  const shown = (units.data ?? []).filter((u) => filter === "ALL" || u.dimension === filter);
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h1 className="m-0 font-display text-2xl font-bold">Unités et conversions</h1>
          <p className="m-0 text-ink-muted">
            Chaque unité se convertit vers sa base : le gramme pour les masses, le millilitre pour
            les volumes (cuillères comprises). Les pièces passent par le poids de chaque ingrédient.
          </p>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setEditing({ unit: null });
          }}
        >
          Ajouter une unité
        </Button>
      </div>
      <SegmentedControl label="Dimension" options={FILTERS} value={filter} onChange={setFilter} />
      {units.isPending ? (
        <Skeleton label="Chargement des unités" />
      ) : units.isError ? (
        <FormAlert message={errorMessage(units.error)} />
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <TableScroll label="Unités" className="min-w-0 flex-[999_1_480px]">
            <table aria-label="Unités" className="fm-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Affichage (fr)</th>
                  <th scope="col">Dimension</th>
                  <th scope="col">Vers la base</th>
                  <th scope="col">Anglais</th>
                  <th scope="col">
                    <span className="fm-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((unit) => (
                  <tr key={unit.id}>
                    <td className="font-mono">{unit.code}</td>
                    <th scope="row" className="font-semibold">
                      {unit.fr.abbreviation}
                    </th>
                    <td>{DIMENSION_LABELS[unit.dimension]}</td>
                    <td className="font-mono">{baseLabel(unit)}</td>
                    <td>{unit.en?.abbreviation ?? <Badge tone="warning">À traduire</Badge>}</td>
                    <td>
                      <IconButton
                        icon="pencil"
                        label={`Modifier ${unit.fr.abbreviation}`}
                        onClick={() => {
                          setEditing({ unit });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <AdditionTester units={units.data} />
        </div>
      )}
      <Sheet
        open={editing !== null}
        onClose={close}
        title={editing?.unit ? `Modifier « ${editing.unit.fr.abbreviation} »` : "Ajouter une unité"}
      >
        {editing ? <UnitForm unit={editing.unit} onClose={close} /> : null}
      </Sheet>
    </>
  );
}
