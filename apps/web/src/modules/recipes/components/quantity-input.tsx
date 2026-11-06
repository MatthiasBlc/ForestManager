// QuantityInput du design system (D108) : quantite + unite + ingredient sur une
// ligne. Quantite a la francaise ("1,5"), unites du referentiel, autocompletion
// des ingredients ; un ingredient inconnu se propose en "Ajouter" et sera cree a
// l'enregistrement (D09).
import type { Unit } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { cx } from "../../../ui/cx.ts";
import { IconButton } from "../../../ui/button.tsx";
import { Badge } from "../../../ui/display.tsx";
import { Icon } from "../../../ui/icon.tsx";
import { ingredientSearchQuery } from "../queries.ts";

export interface IngredientLine {
  quantity: string;
  unitId: string;
  /** Nom saisi ou choisi. */
  name: string;
  /** null tant que le nom n'a pas ete choisi dans les propositions. */
  ingredientId: string | null;
}

interface Row {
  label: string;
  name: string;
  ingredientId: string | null;
}

function useDebounced(value: string, delay = 200): string {
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

export function QuantityInput({
  label,
  value,
  units,
  error,
  mark,
  onChange,
  onRemove,
}: {
  label: string;
  value: IngredientLine;
  units: readonly Unit[];
  error?: string;
  /** Mode suggestion : ligne modifiee (avec la quantite d'avant) ou ajoutee. */
  mark?: { kind: "changed" | "added"; before?: string };
  onChange: (value: IngredientLine) => void;
  onRemove?: () => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const term = useDebounced(open && value.ingredientId === null ? value.name.trim() : "");
  const search = useQuery(ingredientSearchQuery(term));

  const typed = value.name.trim();
  const found: Row[] = (search.data ?? []).map((ingredient) => ({
    label: ingredient.matchedName
      ? `${ingredient.name} (${ingredient.matchedName})`
      : ingredient.name,
    name: ingredient.name,
    ingredientId: ingredient.id,
  }));
  const exact = found.some((row) => row.name.toLowerCase() === typed.toLowerCase());
  const rows: Row[] =
    typed && term
      ? [
          ...found,
          ...(exact ? [] : [{ label: `Ajouter "${typed}"`, name: typed, ingredientId: null }]),
        ]
      : [];
  const expanded = open && value.ingredientId === null && rows.length > 0;

  const choose = (row: Row) => {
    onChange({ ...value, name: row.name, ingredientId: row.ingredientId });
    setOpen(false);
  };

  return (
    <div
      className={cx("fm-qty", error && "fm-field-error", mark && `fm-mark-${mark.kind}`)}
      role="group"
      aria-label={label}
    >
      <div className="fm-qty-row">
        <input
          className="fm-input fm-qty-num"
          inputMode="decimal"
          aria-label="Quantité"
          placeholder="Qté"
          value={value.quantity}
          onChange={(event) => {
            onChange({ ...value, quantity: event.target.value.replace(".", ",") });
          }}
        />
        <select
          className="fm-input fm-qty-unit"
          aria-label="Unité"
          value={value.unitId}
          onChange={(event) => {
            onChange({ ...value, unitId: event.target.value });
          }}
        >
          <option value="">-</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.abbreviation}
            </option>
          ))}
        </select>
        <div className="fm-qty-ing">
          <input
            className="fm-input"
            role="combobox"
            aria-label="Ingrédient"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Ingrédient"
            value={value.name}
            onChange={(event) => {
              onChange({ ...value, name: event.target.value, ingredientId: null });
              setOpen(true);
              setSelected(0);
            }}
            onFocus={() => {
              setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
            }}
            onKeyDown={(event) => {
              if (!expanded) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((index) => Math.min(rows.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const row = rows[selected];
                if (row) choose(row);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {expanded ? (
            <ul className="fm-qty-list" role="listbox" id={listId} aria-label="Ingrédients">
              {rows.map((row, index) => (
                <li
                  key={row.label}
                  role="option"
                  aria-selected={index === selected}
                  className={row.ingredientId === null ? "fm-qty-add" : undefined}
                  onMouseDown={(event) => {
                    // Avant le blur du champ : le choix doit passer.
                    event.preventDefault();
                    choose(row);
                  }}
                >
                  {row.ingredientId === null ? <Icon name="plus" size={16} /> : null}
                  {row.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {onRemove ? <IconButton icon="x" label={`Retirer ${label}`} onClick={onRemove} /> : null}
      </div>
      {mark ? (
        <div className="fm-mark">
          {mark.kind === "added" ? (
            <Badge tone="success">Ajouté</Badge>
          ) : (
            <Badge tone="warning">Modifié</Badge>
          )}
          {mark.before !== undefined ? <small>Avant : {mark.before}</small> : null}
        </div>
      ) : null}
      {error ? <span className="fm-hint">{error}</span> : null}
    </div>
  );
}
