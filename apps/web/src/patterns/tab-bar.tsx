// TabBar (mobile, D131) : les onglets prepares par la navigation, puis "Plus" qui
// ouvre le reste en feuille ; sans reste, pas de "Plus" (D209).
import { Link } from "react-router";

import { Icon } from "../ui/icon.tsx";
import type { NavItem } from "./nav-item.ts";

export const TAB_MAX = 4;

export function TabBar({
  items,
  activeId,
  onMore,
}: {
  /** Onglets, deja limites par la navigation (TAB_MAX, ou un de plus sans "Plus"). */
  items: readonly NavItem[];
  activeId?: string;
  /** Absent : rien dans "Plus", pas de bouton. */
  onMore?: () => void;
}) {
  const shown = items;
  const moreActive = !shown.some((item) => item.id === activeId) && activeId !== undefined;
  return (
    <nav className="fm-tabbar" aria-label="Navigation">
      {shown.map((item) => (
        <Link key={item.id} to={item.to} aria-current={item.id === activeId ? "page" : undefined}>
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
      {onMore ? (
        <button
          type="button"
          aria-current={moreActive ? "page" : undefined}
          aria-haspopup="dialog"
          onClick={onMore}
        >
          <Icon name="more" />
          Plus
        </button>
      ) : null}
    </nav>
  );
}
