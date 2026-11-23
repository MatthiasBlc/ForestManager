// MealSlot (design system) : un repas de la grille. Recette (fond accent), texte,
// vide (pointille) ou "Pas de repas" (barre). Au planning, toucher un repas ouvre F-REPAS ;
// appui long, clic droit ou touche Menu ouvrent la recette d'un repas-recette [D230].
// Sur l'accueil, la case est un lien vers la recette [D204]. Un repas se glisse sur un
// autre pour les echanger, a la souris ou au doigt apres un appui long (`usePointerDrag`).
import { useId, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { cx } from "../../ui/cx.ts";
import { Icon } from "../../ui/icon.tsx";
import { useLongPress } from "../../ui/use-long-press.ts";
import type { usePointerDrag } from "../../ui/use-pointer-drag.ts";

/** Gestes d'une case qu'on peut prendre (`usePointerDrag().source`). */
export type DragSource = ReturnType<ReturnType<typeof usePointerDrag>["source"]>;

export type SlotKind = "recipe" | "text" | "empty" | "off";

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
  /** Accueil : lien vers la recette (le toucher la suit au lieu de `onOpen`). */
  href?: string;
  /** Appui long, clic droit, touche Menu : la recette d'un repas-recette au planning [D230]. */
  onMenu?: () => void;
  /** Case qu'on peut prendre pour l'echanger (gere aussi appui long et clic droit). */
  dragSource?: DragSource | undefined;
  /** Case ou l'on peut lacher un repas : son identifiant. */
  dropId?: string | undefined;
  /** Vient d'etre echangee : courte animation. */
  swapped?: boolean;
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
  dragSource,
  dropId,
  swapped = false,
}: MealSlotProps) {
  const label = kind === "empty" ? placeholder : kind === "off" ? "Pas de repas" : (title ?? "");
  const name = [
    `${when} : ${label}`,
    servings ? `${servings} pers.` : null,
    locked ? "verrouillé" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const drag = { ...(dropId ? { "data-drop-id": dropId } : {}), ...dragSource };
  const className = cx(
    "fm-slot",
    `fm-slot-${kind}`,
    compact && "fm-slot-compact",
    selected && "ring-2 ring-accent",
    swapped && "fm-slot-swapped"
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
  if (href || onMenu) {
    return (
      <SecondarySlot
        href={href}
        onOpen={onOpen}
        name={name}
        className={className}
        onMenu={onMenu}
        drag={drag}
        draggable={!!dragSource}
      >
        {content}
      </SecondarySlot>
    );
  }
  return (
    <button type="button" className={className} aria-label={name} onClick={onOpen} {...drag}>
      {content}
    </button>
  );
}

/** Case lien (accueil) ou bouton (planning), avec la recette en geste secondaire. */
function SecondarySlot({
  href,
  onOpen,
  name,
  className,
  onMenu,
  drag,
  draggable,
  children,
}: {
  href: string | undefined;
  onOpen: (() => void) | undefined;
  name: string;
  className: string;
  onMenu: (() => void) | undefined;
  drag: object;
  /** Les gestes du glisser remplacent l'appui long et le clic droit. */
  draggable: boolean;
  children: ReactNode;
}) {
  const hintId = useId();
  const press = useLongPress(() => onMenu?.());
  if (!onMenu && href) {
    return (
      <Link to={href} className={className} aria-label={name} {...drag}>
        {children}
      </Link>
    );
  }
  const gestures = {
    className,
    "aria-label": name,
    "aria-describedby": hintId,
    ...(draggable
      ? drag
      : {
          ...drag,
          ...press.handlers,
          // Clic droit, touche Menu et Maj+F10 emettent tous `contextmenu`.
          onContextMenu: (event: MouseEvent) => {
            event.preventDefault();
            onMenu?.();
          },
        }),
  };
  const hint = (
    <span id={hintId} hidden>
      Appui long ou clic droit : ouvrir la recette
    </span>
  );
  if (href) {
    return (
      <Link to={href} {...gestures}>
        {children}
        {hint}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onOpen} {...gestures}>
      {children}
      {hint}
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
