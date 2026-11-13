// Donnees d'affichage d'un espace et libelle accessible (rail, selecteur, listes).
import type { CSSProperties } from "react";

export interface SpaceVisual {
  id: string;
  name: string;
  tint?: number;
  image?: string | null;
  /** Espace supprime, encore restaurable : jours restants. */
  deleting?: { daysLeft: number } | null;
  unread?: boolean;
  hint?: string;
}

/** Libelle accessible : nom, suppression programmee, nouveautes. */
export function spaceLabel(space: SpaceVisual): string {
  const days = space.deleting?.daysLeft;
  return (
    space.name +
    (days !== undefined ? `, suppression dans ${days} jour${days > 1 ? "s" : ""}` : "") +
    (space.unread ? ", nouveautés" : "")
  );
}

export function tintStyle(tint: number | undefined): CSSProperties | undefined {
  return tint
    ? ({ "--tint": `var(--tint-${tint})`, "--tint-ink": `var(--on-tint-${tint})` } as CSSProperties)
    : undefined;
}
