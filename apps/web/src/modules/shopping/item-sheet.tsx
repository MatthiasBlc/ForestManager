// F-ARTICLE [D228, D231] : toucher le produit ouvre son detail. D'ou vient la
// quantite ("pour : ..."), la corriger, changer de section (la ligne seule ; "Toujours
// ranger ici" en fait la favorite du produit), monter ou descendre, retirer.
// Aucune confirmation : Annuler dans le toast.
import type { ShoppingItem, ShoppingSection, Unit } from "@fm/shared";
import { useState } from "react";

import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { whenLabel } from "../meal-plan/dates.ts";
import { formatParts, itemName, parseAmount } from "./entry.ts";
import { sectionItems, useShopping } from "./use-shopping.ts";

const OTHERS = "Autres";

function SectionPicker({
  sections,
  value,
  disabled,
  onChange,
}: {
  sections: readonly ShoppingSection[];
  value: string | null;
  disabled: boolean;
  onChange: (sectionId: string | null) => void;
}) {
  const options = [...sections, { id: null, name: OTHERS }];
  return (
    <div role="radiogroup" aria-label="Section" className="flex flex-wrap gap-2">
      {options.map((section) => (
        <label key={section.id ?? "others"} className="fm-chip fm-chip-radio">
          <input
            type="radio"
            name="section"
            className="sr-only"
            checked={section.id === value}
            disabled={disabled}
            onChange={() => {
              onChange(section.id);
            }}
          />
          {section.name}
        </label>
      ))}
    </div>
  );
}

function AmountForm({
  item,
  units,
  disabled,
  onSave,
}: {
  item: ShoppingItem;
  units: readonly Unit[];
  disabled: boolean;
  onSave: (parts: NonNullable<ReturnType<typeof parseAmount>>) => void;
}) {
  const [text, setText] = useState(() => formatParts(item.parts, units));
  const [error, setError] = useState<string>();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parts = parseAmount(text, units);
        if (parts === null) {
          setError("Quantité illisible : « 2 », « 500 g », « 500 g + 3 ».");
          return;
        }
        setError(undefined);
        onSave(parts);
      }}
    >
      <Field
        label="Quantité"
        className="flex-1"
        value={text}
        placeholder="Sans quantité"
        error={error}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={disabled}
        aria-label="Enregistrer la quantité"
      >
        OK
      </Button>
    </form>
  );
}

export function ItemSheet({
  spaceId,
  item,
  items,
  sections,
  units,
  canEdit,
  onClose,
}: {
  spaceId: string;
  item: ShoppingItem;
  items: readonly ShoppingItem[];
  sections: readonly ShoppingSection[];
  units: readonly Unit[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const guard = useWriteGuard();
  const { update, remove, reorder } = useShopping(spaceId);
  const readOnly = !canEdit || guard.disabled === true;
  const name = itemName(item);
  const section = sections.find((s) => s.id === item.sectionId);

  // Monter / Descendre parmi les articles a acheter ; les achetes restent en fin.
  const ordered = sectionItems(items, item.sectionId);
  const toBuy = ordered.filter((i) => i.checkedAt === null);
  const index = toBuy.findIndex((i) => i.id === item.id);
  const move = (delta: number) => {
    const next = [...toBuy];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + delta, 0, moved);
    const ids = [...next, ...ordered.filter((i) => i.checkedAt !== null)].map((i) => i.id);
    reorder.mutate({ sectionId: item.sectionId, ids });
  };

  return (
    <Sheet open onClose={onClose} title={name}>
      <div className="fm-stack">
        {item.sources.length > 0 ? (
          <ul className="fm-shop-sources" aria-label="Pour les repas">
            {item.sources.map((source, i) => (
              <li key={`${source.mealSlotId ?? source.recipeTitle}-${String(i)}`}>
                <span>
                  {source.recipeTitle} · {whenLabel(source.date, source.mealTime)}
                </span>
                <span className="fm-shop-qty">{formatParts(source.parts, units)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="fm-stack gap-2">
          <b className="text-sm">Section</b>
          <SectionPicker
            sections={sections}
            value={item.sectionId}
            disabled={readOnly}
            onChange={(sectionId) => {
              update.mutate({ itemId: item.id, body: { sectionId } });
            }}
          />
          {section && !readOnly ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                icon="check"
                onClick={() => {
                  update.mutate(
                    { itemId: item.id, body: { sectionId: section.id, rememberSection: true } },
                    {
                      onSuccess: () => {
                        toast(`${name} : toujours rangé dans « ${section.name} »`, {
                          tone: "success",
                        });
                      },
                    }
                  );
                }}
              >
                Toujours ranger dans « {section.name} »
              </Button>
            </div>
          ) : null}
        </div>
        <AmountForm
          key={item.id}
          item={item}
          units={units}
          disabled={readOnly}
          onSave={(parts) => {
            update.mutate({ itemId: item.id, body: { parts } });
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="arrow-up"
            disabled={readOnly || index <= 0}
            onClick={() => {
              move(-1);
            }}
          >
            Monter
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="arrow-down"
            disabled={readOnly || index < 0 || index >= toBuy.length - 1}
            onClick={() => {
              move(1);
            }}
          >
            Descendre
          </Button>
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            disabled={readOnly}
            onClick={() => {
              remove.mutate(item);
              onClose();
            }}
          >
            Retirer de la liste
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
