// Shell d'un espace : rail (bureau), selecteur d'espaces (mobile), barre du
// module, en-tete, onglets et "Plus", routes du socle et des modules.
import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { WEB_MODULES } from "../../modules/index.ts";
import { AppShell } from "../../patterns/app-shell.tsx";
import { ModuleNav } from "../../patterns/module-nav.tsx";
import type { NavItem } from "../../patterns/nav-item.ts";
import { SpaceRail } from "../../patterns/space-rail.tsx";
import { SpaceSwitcher } from "../../patterns/space-switcher.tsx";
import { TabBar } from "../../patterns/tab-bar.tsx";
import { TopBar } from "../../patterns/top-bar.tsx";
import { useSpaceTint } from "../../theme/use-space-tint.ts";
import { Button } from "../../ui/button.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { writeLastSection, writeLastSpace } from "../session/last-space.ts";
import { isNetworkError } from "../../lib/api.ts";
import { meQuery, spaceQuery, spacesQuery } from "../session/queries.ts";
import { ActivityPage } from "../activity/activity-page.tsx";
import { HomePage } from "../home/home-page.tsx";
import { unreadCountQuery } from "../notifications/queries.ts";
import { ModulesPage } from "../modules/modules-page.tsx";
import { SearchPalette } from "../search/search-palette.tsx";
import { usePaletteShortcut } from "../search/use-palette-shortcut.ts";
import { CreateSpaceSheet } from "../spaces/create-space-sheet.tsx";
import { DeletedSpacePage } from "../spaces/deleted-space-page.tsx";
import { MembersPage } from "../spaces/members-page.tsx";
import { SettingsPage } from "../spaces/settings-page.tsx";
import { buildNavigation } from "./navigation.ts";
import { ChromeProvider } from "./page-chrome.tsx";
import { useChromeSlots } from "./use-chrome-slots.tsx";
import { toVisual } from "./space-visual.ts";
import { plural } from "../../lib/plural.ts";

/** Entree active : celle dont le chemin couvre le mieux l'adresse courante. */
function activeItem(items: readonly NavItem[], pathname: string): NavItem | undefined {
  return items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

function MoreSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Plus">
      <div className="fm-options" role="list">
        {items.map((item) => (
          <Link key={item.id} to={item.to} className="fm-option" onClick={onClose}>
            <span className="fm-option-icon">
              <Icon name={item.icon} />
            </span>
            <span className="fm-option-text">
              <b>{item.label}</b>
            </span>
            <Icon name="chevron-right" className="fm-option-go" />
          </Link>
        ))}
      </div>
    </Sheet>
  );
}

function SpaceNotFound({ personalSpaceId }: { personalSpaceId: string }) {
  return (
    <div className="p-4">
      <EmptyState
        icon="search"
        title="Espace introuvable"
        action={
          <Link to={`/s/${personalSpaceId}`} className="fm-btn fm-btn-primary">
            Revenir à mon espace
          </Link>
        }
      >
        Cet espace n'existe pas ou tu n'en fais plus partie.
      </EmptyState>
    </div>
  );
}

export function SpaceLayout() {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const me = useQuery(meQuery);
  const spaces = useQuery(spacesQuery);
  const space = useQuery(spaceQuery(spaceId));
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(useCallback(() => setPaletteOpen(true), []));
  const chrome = useChromeSlots();
  const [params, setParams] = useSearchParams();
  const createOpen = params.get("create") === "1";
  const setCreateOpen = (open: boolean) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (open) next.set("create", "1");
        else next.delete("create");
        return next;
      },
      { replace: true }
    );
  };

  useSpaceTint(space.data?.tintIndex ?? null);
  useEffect(() => {
    if (space.data) writeLastSpace(space.data.id);
  }, [space.data]);
  useEffect(() => {
    if (!space.data) return;
    const item = activeItem(buildNavigation(space.data, WEB_MODULES).items, location.pathname);
    if (item) writeLastSection(space.data.id, item.to.slice(`/s/${space.data.id}/`.length));
  }, [space.data, location.pathname]);

  const visuals = (spaces.data ?? []).map(toVisual);
  const personal = visuals.find((v) => v.id === me.data?.personalSpaceId);
  const groups = visuals.filter((v) => v.id !== me.data?.personalSpaceId);
  const selectSpace = (id: string) => {
    setSwitcherOpen(false);
    void navigate(`/s/${id}`);
  };
  const addSpace = () => {
    setSwitcherOpen(false);
    setCreateOpen(true);
  };

  const rail = (
    <SpaceRail
      personal={personal}
      spaces={groups}
      activeId={spaceId}
      onSelect={selectSpace}
      onAdd={addSpace}
    />
  );
  const switcher = (
    <SpaceSwitcher
      open={switcherOpen}
      onClose={() => setSwitcherOpen(false)}
      personal={personal}
      spaces={groups}
      activeId={spaceId}
      onSelect={selectSpace}
      onAdd={addSpace}
    />
  );
  const createSheet = <CreateSpaceSheet open={createOpen} onClose={() => setCreateOpen(false)} />;
  const user = me.data
    ? { name: me.data.username, to: "/profile", avatarUrl: me.data.avatarUrl }
    : undefined;
  const unread = useQuery({ ...unreadCountQuery, enabled: Boolean(me.data) });

  const deleted = spaces.data?.find((s) => s.id === spaceId && s.deletedAt);
  // Une relecture sans reseau n'efface pas l'espace deja lu (D35) : seule une
  // reponse de l'API (ou l'absence de toute copie) dit qu'il est introuvable.
  const failed = space.isError && !(space.data && isNetworkError(space.error));
  if (failed && deleted) {
    return (
      <AppShell rail={rail} top={<TopBar title={deleted.name} user={user} />}>
        <DeletedSpacePage space={deleted} />
        {switcher}
        {createSheet}
      </AppShell>
    );
  }
  if (failed) {
    return (
      <AppShell rail={rail} top={<TopBar title="Espace introuvable" user={user} />}>
        <SpaceNotFound personalSpaceId={me.data?.personalSpaceId ?? ""} />
        {switcher}
        {createSheet}
      </AppShell>
    );
  }
  if (!space.data) {
    return (
      <AppShell rail={rail}>
        <Skeleton />
      </AppShell>
    );
  }

  const nav = buildNavigation(space.data, WEB_MODULES);
  const active = activeItem(nav.items, location.pathname);
  const base = `/s/${space.data.id}/`;
  const sectionOf = (item: NavItem) => item.to.slice(base.length);
  // Reprise a l'ouverture (D60) : l'entree memorisee, si elle existe encore.
  const resume = (location.state as { resume?: unknown } | null)?.resume;
  const entry = nav.items.find((item) => sectionOf(item) === resume) ?? nav.items[0];
  const current = visuals.find((v) => v.id === spaceId) ?? toVisual(space.data);
  const activeCodes = new Set(space.data.modules.map((m) => m.code));
  const moduleRoute = (element: ReactNode) => (
    <Suspense fallback={<Skeleton />}>{element}</Suspense>
  );

  return (
    <AppShell
      rail={rail}
      nav={
        <ModuleNav
          spaceName={space.data.name}
          subtitle={
            space.data.kind === "GROUP"
              ? plural(space.data.memberCount, "membre", "membres")
              : "Espace perso"
          }
          items={nav.items}
          activeId={active?.id}
        />
      }
      top={
        <>
          {chrome.claimed ? null : (
            <TopBar
              title={active?.label}
              space={current}
              onSpace={() => setSwitcherOpen(true)}
              {...(space.data.kind === "PERSONAL" || !me.data
                ? {}
                : { homeTo: `/s/${me.data.personalSpaceId}/home` })}
              onSearch={() => setPaletteOpen(true)}
              onNotifications={() => void navigate("/notifications")}
              unread={unread.data}
              user={user}
            />
          )}
          {chrome.topSlot}
        </>
      }
      tabbar={
        <>
          {chrome.claimed ? null : (
            <TabBar items={nav.tabs} activeId={active?.id} onMore={() => setMoreOpen(true)} />
          )}
          {chrome.bottomSlot}
        </>
      }
    >
      <ChromeProvider value={chrome.value}>
        <Routes>
          <Route index element={<Navigate to={entry?.to ?? "home"} replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="members" element={<MembersPage space={space.data} />} />
          <Route path="activity" element={<ActivityPage space={space.data} />} />
          <Route path="settings" element={<SettingsPage space={space.data} />} />
          <Route path="modules" element={<ModulesPage space={space.data} />} />
          {WEB_MODULES.map((module) => (
            <Route
              key={module.code}
              path={`${module.code}/*`}
              element={
                activeCodes.has(module.code) ? (
                  moduleRoute(<module.Routes />)
                ) : (
                  <div className="p-4">
                    <EmptyState icon="puzzle" title="Module inactif">
                      Ce module n'est pas actif dans cet espace.
                    </EmptyState>
                  </div>
                )
              }
            />
          ))}
          <Route
            path="*"
            element={
              <div className="p-4">
                <EmptyState
                  icon="search"
                  title="Page introuvable"
                  action={
                    <Button onClick={() => void navigate(`/s/${spaceId}`)}>
                      Retour à l'espace
                    </Button>
                  }
                />
              </div>
            }
          />
        </Routes>
      </ChromeProvider>
      {switcher}
      {createSheet}
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={nav.more} />
      <SearchPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        space={space.data}
        spaces={spaces.data ?? []}
      />
    </AppShell>
  );
}
