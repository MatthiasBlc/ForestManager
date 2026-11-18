// SpaceSwitcher (mobile, D130) : la liste des espaces en feuille, precedee de
// l'Accueil (D206) : on sait qu'on change d'espace puisqu'on est dans le selecteur.
import { cx } from "../ui/cx.ts";
import { Badge } from "../ui/display.tsx";
import { Icon } from "../ui/icon.tsx";
import { Sheet } from "../ui/sheet.tsx";
import { SpaceIcon } from "./space-icon.tsx";
import type { SpaceVisual } from "./space-label.ts";
import { useSpaceReorder } from "./space-reorder.ts";

export interface SpaceSwitcherProps {
  open: boolean;
  onClose: () => void;
  personal?: SpaceVisual;
  spaces: readonly SpaceVisual[];
  activeId?: string;
  onSelect: (id: string) => void;
  /** Accueil de l'espace perso, en tete de liste. */
  onHome?: () => void;
  onAdd: () => void;
  /** Nouvel ordre des groupes [D218] : appui long puis glisser, ou Alt+fleches. */
  onReorder?: (ids: string[]) => void;
}

export function SpaceSwitcher({
  open,
  onClose,
  personal,
  spaces,
  activeId,
  onSelect,
  onHome,
  onAdd,
  onReorder,
}: SpaceSwitcherProps) {
  const reorder = useSpaceReorder(spaces, onReorder);
  const row = (space: SpaceVisual, movable = false) => {
    const on = space.id === activeId;
    return (
      <button
        key={space.id}
        type="button"
        className={cx("fm-option", on && "fm-option-on")}
        aria-current={on ? "true" : undefined}
        onClick={() => onSelect(space.id)}
        {...(movable ? reorder.item(space.id) : {})}
      >
        {/* Pas d'aria-label : le nom accessible est le texte affiche (axe
            label-content-name-mismatch), les espaces separent ses morceaux. */}
        <SpaceIcon space={space} />
        <span className="fm-option-text">
          <b>{space.name}</b>{" "}
          {space.deleting ? (
            <small className="fm-danger-text">
              Suppression dans {space.deleting.daysLeft} <span aria-hidden="true">j</span>
              <span className="sr-only">jours</span>
            </small>
          ) : space.hint ? (
            <small>{space.hint}</small>
          ) : null}
        </span>{" "}
        {space.unread && !space.deleting ? <Badge tone="accent">Nouveau</Badge> : null}
        {on ? <Icon name="check" className="fm-option-go" /> : null}
      </button>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title="Espaces">
      <div className="fm-options" role="list">
        {onHome ? (
          <>
            <button type="button" className="fm-option" onClick={onHome}>
              <span className="fm-space fm-space-static fm-space-add">
                <Icon name="home" />
              </span>
              <span className="fm-option-text">
                <b>Accueil</b>
              </span>
            </button>
            <hr className="fm-options-sep" />
          </>
        ) : null}
        {personal ? row(personal) : null}
        {personal ? <hr className="fm-options-sep" /> : null}
        {spaces.map((space) => row(space, true))}
        <button type="button" className="fm-option fm-option-add" onClick={onAdd}>
          <span className="fm-space fm-space-static fm-space-add">
            <Icon name="plus" />
          </span>
          <span className="fm-option-text">
            <b>Créer ou rejoindre un espace</b>
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {reorder.message}
        </span>
      </div>
    </Sheet>
  );
}
