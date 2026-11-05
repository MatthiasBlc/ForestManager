// TabBar (mobile, D131) : 4 entrees au plus, puis "Plus" qui ouvre le reste en feuille.
import { Link } from "react-router";

import { Icon } from "../ui/icon.tsx";
import type { NavItem } from "./nav-item.ts";

export const TAB_MAX = 4;

export function TabBar({
  items,
  activeId,
  onMore,
}: {
  /** Entrees principales (au-dela de 4, elles passent dans "Plus"). */
  items: readonly NavItem[];
  activeId?: string;
  onMore: () => void;
}) {
  const shown = items.slice(0, TAB_MAX);
  const moreActive = !shown.some((item) => item.id === activeId) && activeId !== undefined;
  return (
    <nav className="fm-tabbar" aria-label="Navigation">
      {shown.map((item) => (
        <Link key={item.id} to={item.to} aria-current={item.id === activeId ? "page" : undefined}>
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        aria-current={moreActive ? "page" : undefined}
        aria-haspopup="dialog"
        onClick={onMore}
      >
        <Icon name="more" />
        Plus
      </button>
    </nav>
  );
}
