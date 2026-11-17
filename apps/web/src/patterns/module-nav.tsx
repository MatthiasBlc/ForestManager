// ModuleNav (bureau large) : nom de l'espace et ses entrees (modules, membres, reglages).
import { Link } from "react-router";

import { Badge } from "../ui/display.tsx";
import { Icon } from "../ui/icon.tsx";
import type { NavItem } from "./nav-item.ts";

export function ModuleNav({
  spaceName,
  subtitle,
  items,
  activeId,
}: {
  spaceName: string;
  subtitle?: string;
  items: readonly (NavItem & { badge?: string })[];
  activeId?: string;
}) {
  return (
    <aside className="fm-nav" aria-label="Modules de l'espace">
      <div className="fm-nav-head">
        <b>{spaceName}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.to} aria-current={item.id === activeId ? "page" : undefined}>
              <Icon name={item.icon} />
              {item.label}
              {item.badge ? <Badge>{item.badge}</Badge> : null}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
