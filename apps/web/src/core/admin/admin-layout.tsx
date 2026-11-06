// Shell de l'administration : navigation laterale en bureau (AdminNav), en-tete
// et menu en feuille sur mobile (A02m), compte et duree restante de la session.
// Chaque sous-etape de C4 ajoute ses entrees a ADMIN_NAV.
import type { AdminMe } from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";

import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { cx } from "../../ui/cx.ts";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { adminMeQuery, minutesLeft } from "./queries.ts";

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
}

const ADMIN_NAV: readonly { label: string; items: readonly NavEntry[] }[] = [
  { label: "Pilotage", items: [{ to: "/admin", label: "Tableau de bord", icon: "home" }] },
];

/** Minutes restantes, recalculees toutes les 15 s ; a zero, la session est relue. */
function useMinutesLeft(me: AdminMe): number {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const left = minutesLeft(me.sessionExpiresAt, now);
  useEffect(() => {
    if (left === 0) void queryClient.invalidateQueries({ queryKey: adminMeQuery.queryKey });
  }, [left, queryClient]);
  return left;
}

function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Administration" className="flex flex-col gap-5">
      {ADMIN_NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {group.label}
          </span>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-ink no-underline",
                  isActive ? "bg-accent-soft text-accent-text" : "hover:bg-surface-raised"
                )
              }
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SessionCard({ me, left, onLogout }: { me: AdminMe; left: number; onLogout: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-raised p-3">
      <span className="text-[13px] leading-[18px] font-semibold">{me.username}</span>
      <span className="text-xs text-ink-muted">Session admin, expire dans {left} min</span>
      <Button size="sm" variant="ghost" icon="log-out" onClick={onLogout}>
        Se déconnecter
      </Button>
    </div>
  );
}

function Brand({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid place-items-center rounded-md bg-accent font-display font-bold text-on-accent",
        small ? "size-8 text-[13px]" : "size-9 text-[15px]"
      )}
    >
      FM
    </span>
  );
}

export function AdminLayout({ me }: { me: AdminMe }) {
  const queryClient = useQueryClient();
  const left = useMinutesLeft(me);
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await api.post("/admin/auth/logout");
    } finally {
      // La session devient null (retour a la connexion) ; les autres donnees admin sont oubliees.
      queryClient.setQueryData(adminMeQuery.queryKey, null);
      queryClient.removeQueries({
        queryKey: ["admin"],
        predicate: (query) => query.queryKey[1] !== "me",
      });
    }
  };

  return (
    <div className="fm-root flex min-h-full bg-bg text-ink">
      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-5 border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <Brand />
          <div className="flex flex-col">
            <b className="font-display text-[15px] leading-5">Forest Manager</b>
            <span className="text-xs text-ink-muted">Administration</span>
          </div>
        </div>
        <AdminNavLinks />
        <div className="mt-auto">
          <SessionCard me={me} left={left} onLogout={() => void logout()} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-2 border-b border-line py-2 pr-2 pl-4 md:hidden">
          <Brand small />
          <b className="flex-1 font-display text-lg">Admin</b>
          <IconButton
            icon="more"
            label="Menu de l'administration"
            onClick={() => {
              setMenuOpen(true);
            }}
          />
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
      <Sheet
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
        title="Administration"
      >
        <div className="flex flex-col gap-5">
          <AdminNavLinks
            onNavigate={() => {
              setMenuOpen(false);
            }}
          />
          <SessionCard me={me} left={left} onLogout={() => void logout()} />
        </div>
      </Sheet>
    </div>
  );
}
