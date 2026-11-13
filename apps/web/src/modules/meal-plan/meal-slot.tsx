// MealSlot (design system) : un repas de la grille. Recette (fond accent), texte,
// vide (pointille) ou "Pas de repas" (barre). Toucher un repas-recette ouvre la recette ;
// appui long, clic droit ou touche Menu ouvrent F-REPAS [D204]. Les autres cases ouvrent
// F-REPAS au toucher. En bureau, un repas se glisse sur un autre pour les echanger (D69).
import { useId, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { cx } from "../../ui/cx.ts";
import { Icon } from "../../ui/icon.tsx";
import { useLongPress } from "../../ui/use-long-press.ts";

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
  /** Repas-recette : lien vers la recette (le toucher la suit au lieu de `onOpen`). */
  href?: string;
  /** Appui long, clic droit, touche Menu : F-REPAS quand la case est un lien. */
  onMenu?: () => void;
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
  href,
  onMenu,
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
  const className = cx(
    "fm-slot",
    `fm-slot-${kind}`,
    compact && "fm-slot-compact",
    selected && "ring-2 ring-accent"
  );
  const content = (
    <>
      {kind === "empty" ? <Icon name="plus" /> : null}
      {compact && kind === "empty" ? null : <span>{label}</span>}
      {servings && kind !== "empty" && kind !== "off" ? <small>{servings} p.</small> : null}
      {locked ? <Icon name="lock" /> : null}
      {showWhen ? <small className="fm-slot-when">{when}</small> : null}
    </>
  );
  if (href) {
    return (
      <RecipeSlot href={href} name={name} className={className} onMenu={onMenu} drag={drag}>
        {content}
      </RecipeSlot>
    );
  }
  return (
    <button type="button" className={className} aria-label={name} onClick={onOpen} {...drag}>
      {content}
    </button>
  );
}

/** Case lien vers la recette, avec F-REPAS en geste secondaire. */
function RecipeSlot({
  href,
  name,
  className,
  onMenu,
  drag,
  children,
}: {
  href: string;
  name: string;
  className: string;
  onMenu: (() => void) | undefined;
  drag: object;
  children: ReactNode;
}) {
  const hintId = useId();
  const press = useLongPress(() => onMenu?.());
  if (!onMenu) {
    return (
      <Link to={href} className={className} aria-label={name} {...drag}>
        {children}
      </Link>
    );
  }
  return (
    <Link
      to={href}
      className={className}
      aria-label={name}
      aria-describedby={hintId}
      {...drag}
      {...press.handlers}
      // Clic droit, touche Menu et Maj+F10 emettent tous `contextmenu`.
      onContextMenu={(event: MouseEvent) => {
        event.preventDefault();
        onMenu();
      }}
    >
      {children}
      <span id={hintId} hidden>
        Appui long ou clic droit : détails du repas
      </span>
    </Link>
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
