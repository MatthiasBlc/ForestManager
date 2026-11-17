import type { SpaceRole } from "@fm/shared";

import type { Tone } from "../../ui/display.tsx";

export const ROLE_LABELS: Record<SpaceRole, { label: string; tone: Tone }> = {
  OWNER: { label: "Propriétaire", tone: "accent" },
  MODERATOR: { label: "Modérateur", tone: "second" },
  MEMBER: { label: "Membre", tone: "neutral" },
};
