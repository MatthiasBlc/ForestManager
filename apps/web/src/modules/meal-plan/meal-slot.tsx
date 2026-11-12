// MealSlot (design system) : un repas de la grille. Recette (fond accent), texte,
// vide (pointille) ou "Pas de repas" (barre). Toucher l'ouvre (F-REPAS porte ses actions,
// pas d'appui long, D186) ; en bureau il se glisse sur un autre repas pour les echanger (D69).
import type { DragEvent } from "react";

import { cx } from "../../ui/cx.ts";
import { Icon } from "../../ui/icon.tsx";

export type SlotKind = "recipe" | "text" | "empty" | "off";

const DRAG_TYPE = "application/x-fm-meal";

export interface MealSlotProps {
  kind: SlotKind;
  title?: string | null;
  /** Portions affichees quand elles different du defaut de l'espace. */
  servings?: number | null;
  locked?: boolean;
  /** "Mardi 10, midi" : debut du nom accessible. */
  when: string;
  placeholder?: string;
  /** Repas en attente d'echange (mode echange). */
  selected?: boolean;
  /** Grille de bureau : titre sur plusieurs lignes, case vide reduite a "+". */
  compact?: boolean;
  /** Hors de la grille (accueil) : `when` affiche a droite, pas seulement lu. */
  showWhen?: boolean;
  onOpen?: () => void;
  /** Glisser-deposer (bureau) : identifiant de la case. */
  dragId?: string;
  onDropFrom?: (sourceId: string) => void;
}

export function MealSlot({
  kind,
  title,
  servings,
  locked = false,
  when,
  placeholder = "Ajouter un repas",
  selected = false,
  compact = false,
  showWhen = false,
  onOpen,
  dragId,
  onDropFrom,
}: MealSlotProps) {
  const label = kind === "empty" ? placeholder : kind === "off" ? "Pas de repas" : (title ?? "");
  const name = [
    `${when} : ${label}`,
    servings ? `${servings} pers.` : null,
    locked ? "verrouillé" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const drag =
    dragId && onDropFrom
      ? {
          draggable: kind !== "empty",
          onDragStart: (event: DragEvent) => {
            event.dataTransfer.setData(DRAG_TYPE, dragId);
            event.dataTransfer.effectAllowed = "move";
          },
          onDragOver: (event: DragEvent) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          },
          onDrop: (event: DragEvent) => {
            event.preventDefault();
            const source = event.dataTransfer.getData(DRAG_TYPE);
            if (source && source !== dragId) onDropFrom(source);
          },
        }
      : {};
  return (
    <button
      type="button"
      className={cx(
        "fm-slot",
        `fm-slot-${kind}`,
        compact && "fm-slot-compact",
        selected && "ring-2 ring-accent"
      )}
      aria-label={name}
      onClick={onOpen}
      {...drag}
    >
      {kind === "empty" ? <Icon name="plus" /> : null}
      {compact && kind === "empty" ? null : <span>{label}</span>}
      {servings && kind !== "empty" && kind !== "off" ? <small>{servings} p.</small> : null}
      {locked ? <Icon name="lock" /> : null}
      {showWhen ? <small className="fm-slot-when">{when}</small> : null}
    </button>
  );
}

/** Case vide sans droit de modifier : rien a toucher. */
export function EmptyCell() {
  return (
    <div className="fm-slot fm-slot-empty cursor-default" aria-hidden="true">
      <span>—</span>
    </div>
  );
}
