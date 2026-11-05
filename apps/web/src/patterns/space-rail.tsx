// SpaceRail (bureau) : espace perso, separateur, groupes, "Creer ou rejoindre".
import { cx } from "../ui/cx.ts";
import { Icon } from "../ui/icon.tsx";
import { SpaceGlyph } from "./space-icon.tsx";
import { spaceLabel, tintStyle, type SpaceVisual } from "./space-label.ts";

export interface SpaceRailProps {
  personal?: SpaceVisual;
  spaces: readonly SpaceVisual[];
  activeId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function SpaceRail({ personal, spaces, activeId, onSelect, onAdd }: SpaceRailProps) {
  const item = (space: SpaceVisual) => (
    <button
      key={space.id}
      type="button"
      className={cx("fm-space", space.deleting && "fm-space-deleting")}
      style={tintStyle(space.tint)}
      title={spaceLabel(space)}
      aria-label={spaceLabel(space)}
      aria-current={space.id === activeId ? "true" : undefined}
      onClick={() => onSelect(space.id)}
    >
      <SpaceGlyph space={space} />
    </button>
  );
  return (
    <nav className="fm-rail" aria-label="Espaces">
      {personal ? item(personal) : null}
      {personal ? <span className="fm-rail-sep" aria-hidden="true" /> : null}
      {spaces.map(item)}
      <button
        type="button"
        className="fm-space fm-space-add"
        aria-label="Créer ou rejoindre un espace"
        title="Créer ou rejoindre un espace"
        onClick={onAdd}
      >
        <Icon name="plus" />
      </button>
    </nav>
  );
}
