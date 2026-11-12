// Espace de l'API -> donnees d'affichage (rail, selecteur, listes).
import type { SpaceSummary } from "@fm/shared";

import type { SpaceVisual } from "../../patterns/space-label.ts";
import { plural } from "../../lib/plural.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toVisual(space: SpaceSummary): SpaceVisual {
  const daysLeft = space.purgeAfter
    ? Math.max(0, Math.ceil((Date.parse(space.purgeAfter) - Date.now()) / DAY_MS))
    : null;
  return {
    id: space.id,
    name: space.name,
    tint: space.tintIndex,
    image: space.avatarUrl,
    deleting: space.deletedAt && daysLeft !== null ? { daysLeft } : null,
    hint: space.kind === "GROUP" ? plural(space.memberCount, "membre", "membres") : "Espace perso",
  };
}
