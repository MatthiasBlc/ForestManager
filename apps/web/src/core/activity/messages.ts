// Messages du fil d'activite : socle ici, modules par `WebModule.activity` (D34).
import type { ActivityEvent } from "@fm/shared";

import type { ActivityRenderer } from "../../app/registry.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { moduleInfo } from "../modules/module-info.ts";

function text(event: ActivityEvent, key: string): string {
  const value = event.data?.[key];
  return typeof value === "string" ? value : "";
}

const CORE: Record<string, ActivityRenderer> = {
  "core.member.joined": () => ({ text: "a rejoint l'espace.", to: null }),
  "core.member.left": () => ({ text: "a quitté l'espace.", to: null }),
  "core.module.enabled": (event, spaceId) => ({
    text: `a activé le module ${moduleInfo(text(event, "moduleCode")).name}.`,
    to: `/s/${spaceId}/modules`,
  }),
  "core.space.exported": () => ({ text: "a exporté l'espace.", to: null }),
};

export function renderActivity(
  event: ActivityEvent,
  spaceId: string
): { text: string; to: string | null } {
  const renderer =
    CORE[event.type] ?? WEB_MODULES.map((module) => module.activity?.[event.type]).find(Boolean);
  return renderer ? renderer(event, spaceId) : { text: "a fait une modification.", to: null };
}
