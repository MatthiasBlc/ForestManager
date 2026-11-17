// Icone d'un espace : avatar ou initiales sur sa teinte, etat "en suppression"
// (J-n, D96) et pastille de nouveautes. Partagee par le rail, le selecteur
// d'espaces, la TopBar et les listes.
import { cx } from "../ui/cx.ts";
import { initials } from "../ui/initials.ts";
import { tintStyle, type SpaceVisual } from "./space-label.ts";

/** Contenu de l'icone (image ou initiales, compte a rebours, pastille). */
export function SpaceGlyph({ space }: { space: SpaceVisual }) {
  return (
    <>
      {space.image ? <img src={space.image} alt="" /> : initials(space.name)}
      {space.deleting ? (
        <b className="fm-space-count" aria-hidden="true">
          J-{space.deleting.daysLeft}
        </b>
      ) : null}
      {space.unread && !space.deleting ? <i className="fm-space-dot" aria-hidden="true" /> : null}
    </>
  );
}

/**
 * Icone statique (decorative) : le libelle est porte par l'element parent.
 * `lg` : vignette a cote du choix de la photo (F-CREER-ESPACE, reglages).
 */
export function SpaceIcon({ space, size }: { space: SpaceVisual; size?: "lg" }) {
  return (
    <span
      className={cx(
        "fm-space",
        "fm-space-static",
        size === "lg" && "fm-space-lg",
        space.deleting && "fm-space-deleting"
      )}
      style={tintStyle(space.tint)}
      aria-hidden="true"
    >
      <SpaceGlyph space={space} />
    </span>
  );
}
