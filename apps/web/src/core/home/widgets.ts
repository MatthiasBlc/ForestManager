// Widgets d'accueil : registre web (socle + modules) [D193].
import type { WebWidget } from "../../app/registry.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { Activity } from "./activity-widget.tsx";

const CORE_WIDGETS: Readonly<Record<string, WebWidget>> = {
  "core.activity": { title: "Activité des groupes", Component: Activity },
};

export const HOME_WIDGETS: Readonly<Record<string, WebWidget>> = Object.assign(
  {},
  CORE_WIDGETS,
  ...WEB_MODULES.map((module) => module.widgets ?? {})
) as Record<string, WebWidget>;
