// Navigation d'un espace : entrees du socle et des modules actifs, partagees
// entre la barre du module (bureau), les onglets et "Plus" (mobile) [D95, D131].
import type { SpaceDetail } from "@fm/shared";

import type { WebModule } from "../../app/registry.ts";
import type { NavItem } from "../../patterns/nav-item.ts";
import { TAB_MAX } from "../../patterns/tab-bar.tsx";

export interface SpaceNavigation {
  /** Toutes les entrees, dans l'ordre (barre du module). */
  items: NavItem[];
  /** Onglets du bas (4 au plus). */
  tabs: NavItem[];
  /** Contenu de "Plus". */
  more: NavItem[];
}

export function buildNavigation(
  space: SpaceDetail,
  modules: readonly WebModule[]
): SpaceNavigation {
  const base = `/s/${space.id}`;
  const byCode = new Map(modules.map((m) => [m.code, m]));
  const moduleItems: NavItem[] = [...space.modules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((active) => byCode.get(active.code)?.nav(space.kind) ?? [])
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: entry.icon,
      to: `${base}/${entry.path}`,
    }));

  const home: NavItem = { id: "home", label: "Accueil", icon: "home", to: `${base}/home` };
  const members: NavItem = {
    id: "members",
    label: "Membres",
    icon: "users",
    to: `${base}/members`,
  };
  const activity: NavItem = {
    id: "activity",
    label: "Activité",
    icon: "history",
    to: `${base}/activity`,
  };
  const settings: NavItem = {
    id: "settings",
    label: "Réglages",
    icon: "settings",
    to: `${base}/settings`,
  };

  const primary = space.kind === "PERSONAL" ? [home, ...moduleItems] : moduleItems;
  const secondary = space.kind === "PERSONAL" ? [settings] : [members, activity, settings];
  const tabs = primary.slice(0, TAB_MAX);
  return {
    items: [...primary, ...secondary],
    tabs,
    more: [...primary.slice(TAB_MAX), ...secondary],
  };
}
