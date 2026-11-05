// SpaceSwitcher (mobile, D130) : la liste des espaces en feuille.
import { cx } from "../ui/cx.ts";
import { Badge } from "../ui/display.tsx";
import { Icon } from "../ui/icon.tsx";
import { Sheet } from "../ui/sheet.tsx";
import { SpaceIcon } from "./space-icon.tsx";
import { spaceLabel, type SpaceVisual } from "./space-label.ts";

export interface SpaceSwitcherProps {
  open: boolean;
  onClose: () => void;
  personal?: SpaceVisual;
  spaces: readonly SpaceVisual[];
  activeId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function SpaceSwitcher({
  open,
  onClose,
  personal,
  spaces,
  activeId,
  onSelect,
  onAdd,
}: SpaceSwitcherProps) {
  const row = (space: SpaceVisual) => {
    const on = space.id === activeId;
    return (
      <button
        key={space.id}
        type="button"
        className={cx("fm-option", on && "fm-option-on")}
        aria-current={on ? "true" : undefined}
        aria-label={spaceLabel(space)}
        onClick={() => onSelect(space.id)}
      >
        <SpaceIcon space={space} />
        <span className="fm-option-text">
          <b>{space.name}</b>
          {space.deleting ? (
            <small className="fm-danger-text">Suppression dans {space.deleting.daysLeft} j</small>
          ) : space.hint ? (
            <small>{space.hint}</small>
          ) : null}
        </span>
        {space.unread && !space.deleting ? <Badge tone="accent">Nouveau</Badge> : null}
        {on ? <Icon name="check" className="fm-option-go" /> : null}
      </button>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title="Espaces">
      <div className="fm-options" role="list">
        {personal ? row(personal) : null}
        {personal ? <hr className="fm-options-sep" /> : null}
        {spaces.map(row)}
        <button type="button" className="fm-option fm-option-add" onClick={onAdd}>
          <span className="fm-space fm-space-static fm-space-add">
            <Icon name="plus" />
          </span>
          <span className="fm-option-text">
            <b>Créer ou rejoindre un espace</b>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
