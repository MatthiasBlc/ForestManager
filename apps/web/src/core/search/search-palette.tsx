// Recherche globale (F-RECHERCHE, P16) [D119, D191] : la palette compose les
// groupes de l'API (traduits par le socle et les modules) et les actions,
// declarees cote client et filtrees par le texte tape sans appel.
import {
  normalizeName,
  SEARCH_MIN_LENGTH,
  type SearchItem,
  type SpaceDetail,
  type SpaceSummary,
} from "@fm/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

import type { PaletteAction, SearchGroupView, SearchResultView } from "../../app/registry.ts";
import { useDebounced } from "../../lib/use-debounced.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { CommandPalette, type PaletteGroup } from "../../ui/command-palette.tsx";
import { canIn } from "../spaces/queries.ts";
import { searchQuery } from "./queries.ts";
import { readRecentRecipes } from "./recent.ts";

/** Groupes du socle : membres des espaces partages, espaces par leur nom. */
const CORE_GROUPS: Readonly<Record<string, SearchGroupView>> = {
  "core.members": {
    label: "Membres",
    render: (item: SearchItem) => ({
      label: item.title,
      icon: "users",
      hint: item.spaceName,
      to: `/s/${item.spaceId}/members`,
    }),
  },
  "core.spaces": {
    label: "Espaces",
    render: (item: SearchItem) => ({
      label: item.title,
      icon: "home",
      hint: "Espace",
      to: `/s/${item.spaceId}`,
    }),
  },
};

const GROUP_VIEWS: Readonly<Record<string, SearchGroupView>> = Object.assign(
  {},
  ...WEB_MODULES.map((module) => module.searchGroups ?? {}),
  CORE_GROUPS
) as Record<string, SearchGroupView>;

/** Actions du socle, puis celles des modules actifs dans l'espace courant. */
function actionsFor(space: SpaceDetail, pathname: string): PaletteAction[] {
  const active = new Set(space.modules.map((m) => m.code));
  const modules = WEB_MODULES.filter((m) => active.has(m.code)).flatMap(
    (m) => m.actions?.(space) ?? []
  );
  const core: PaletteAction[] = [
    ...(space.kind === "GROUP" && canIn(space, "space.invites.manage")
      ? [
          {
            id: "core.invite",
            label: "Inviter quelqu'un",
            icon: "user-plus",
            to: `/s/${space.id}/members?invite=1`,
            keywords: "membre lien",
          } as const,
        ]
      : []),
    {
      id: "core.space.create",
      label: "Créer un espace",
      icon: "plus",
      to: `${pathname}?create=1`,
      keywords: "nouvel espace groupe",
    },
    {
      id: "core.profile",
      label: "Mon profil",
      icon: "settings",
      to: "/profile",
      keywords: "compte",
    },
    {
      id: "core.appearance",
      label: "Apparence",
      icon: "palette",
      to: "/profile/appearance",
      keywords: "theme sombre clair texte",
    },
    { id: "core.notifications", label: "Notifications", icon: "bell", to: "/notifications" },
  ];
  return [...modules, ...core];
}

function matches(action: PaletteAction, text: string): boolean {
  const haystack = normalizeName(`${action.label} ${action.keywords ?? ""}`);
  return normalizeName(text)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

interface Entry {
  to: string;
  state?: unknown;
}

export interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  space: SpaceDetail;
  spaces: readonly SpaceSummary[];
}

export function SearchPalette({ open, onClose, space, spaces }: SearchPaletteProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const text = query.trim();
  const debounced = useDebounced(text);
  const searching = open && debounced.length >= SEARCH_MIN_LENGTH;
  const results = useQuery({
    ...searchQuery(debounced, space.id),
    enabled: searching,
    placeholderData: keepPreviousData,
  });

  const entries = new Map<string, Entry>();
  const toItems = (prefix: string, views: { id: string; view: SearchResultView }[]) =>
    views.map(({ id, view }) => {
      const key = `${prefix}:${id}`;
      entries.set(key, { to: view.to, state: view.state });
      return { id: key, label: view.label, icon: view.icon, hint: view.hint };
    });

  const groups: PaletteGroup[] = [];
  if (text.length >= SEARCH_MIN_LENGTH && results.data) {
    for (const group of results.data.groups) {
      const view = GROUP_VIEWS[group.key];
      if (!view) continue;
      groups.push({
        id: group.key,
        label: view.label,
        items: toItems(
          group.key,
          group.items.map((item) => ({ id: item.id, view: view.render(item) }))
        ),
      });
    }
  }
  if (text === "") {
    const names = new Map(spaces.map((s) => [s.id, s.name]));
    const recent = readRecentRecipes().filter((r) => names.has(r.spaceId));
    groups.push({
      id: "recent",
      label: "Récemment ouvertes",
      items: toItems(
        "recent",
        recent.map((r) => ({
          id: r.id,
          view: {
            label: r.title,
            icon: "clock",
            hint: names.get(r.spaceId),
            to: `/s/${r.spaceId}/recipes/${r.id}`,
          },
        }))
      ),
    });
  }
  const actions = actionsFor(space, pathname).filter((a) => text === "" || matches(a, text));
  groups.push({
    id: "actions",
    label: "Actions",
    items: toItems(
      "action",
      actions.map((a) => ({ id: a.id, view: { label: a.label, icon: a.icon, to: a.to } }))
    ),
  });
  // A vide, les actions passent devant les recettes recentes.
  if (text === "") groups.reverse();

  const pending = searching && (results.isPending || debounced !== text);
  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <CommandPalette
      open={open}
      onClose={close}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      status={
        results.isError && searching
          ? "La recherche n'a pas abouti. Vérifie ta connexion."
          : pending && !results.data
            ? "Recherche…"
            : undefined
      }
      empty={pending ? undefined : `Rien trouvé pour « ${text} »`}
      onSelect={(id) => {
        const entry = entries.get(id);
        if (!entry) return;
        close();
        void navigate(entry.to, { state: entry.state });
      }}
    />
  );
}
