// SpaceRail (bureau) : espace perso, separateur, groupes, "Creer ou rejoindre".
// Les groupes se rangent au glisser ou par Alt+fleches [D218].
import { cx } from "../ui/cx.ts";
import { Icon } from "../ui/icon.tsx";
import { SpaceGlyph } from "./space-icon.tsx";
import { spaceLabel, tintStyle, type SpaceVisual } from "./space-label.ts";
import { useSpaceReorder } from "./space-reorder.ts";

export interface SpaceRailProps {
  personal?: SpaceVisual;
  spaces: readonly SpaceVisual[];
  activeId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** Nouvel ordre des groupes [D218] ; sans lui, le rail ne se range pas. */
  onReorder?: (ids: string[]) => void;
  /** Reserve au bureau : masque sur mobile, ou la barre du haut suffit (D209). */
  desktopOnly?: boolean;
}

export function SpaceRail({
  personal,
  spaces,
  activeId,
  onSelect,
  onAdd,
  onReorder,
  desktopOnly = false,
}: SpaceRailProps) {
  const reorder = useSpaceReorder(spaces, onReorder);
  const item = (space: SpaceVisual, movable: boolean) => (
    <button
      key={space.id}
      type="button"
      className={cx("fm-space", space.deleting && "fm-space-deleting")}
      style={tintStyle(space.tint)}
      title={spaceLabel(space)}
      aria-current={space.id === activeId ? "true" : undefined}
      onClick={() => onSelect(space.id)}
      {...(movable ? reorder.item(space.id) : {})}
    >
      {/* Le bouton tire son nom de cette image : un aria-label sur le bouton
          contredirait les initiales et le "J-n" affiches (axe label-content-name-mismatch). */}
      <span role="img" aria-label={spaceLabel(space)} className="contents">
        <SpaceGlyph space={space} />
      </span>
    </button>
  );
  return (
    <nav className={cx("fm-rail", desktopOnly && "fm-rail-desktop")} aria-label="Espaces">
      {personal ? item(personal, false) : null}
      {personal ? <span className="fm-rail-sep" aria-hidden="true" /> : null}
      {spaces.map((space) => item(space, true))}
      <button
        type="button"
        className="fm-space fm-space-add"
        aria-label="Créer ou rejoindre un espace"
        title="Créer ou rejoindre un espace"
        onClick={onAdd}
      >
        <Icon name="plus" />
      </button>
      <span className="sr-only" aria-live="polite">
        {reorder.message}
      </span>
    </nav>
  );
}
