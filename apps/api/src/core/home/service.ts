// Accueil a widgets (E-ACCUEIL, D60) [D193] : registre des widgets du socle et
// des modules, choix de l'utilisateur, donnees en un appel.
import type { HomeResponse } from "@fm/shared";

import { activityInclude, toActivityEvent } from "../activity/service.ts";
import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { activeSpaces, type ActiveSpace } from "../spaces/active-spaces.ts";
import type { ApiWidget } from "./types.ts";

const ACTIVITY_LIMIT = 8;

/** Widgets du socle : `core.activity` (espaces groupe), coupe par defaut. */
const CORE_WIDGETS: Readonly<Record<string, ApiWidget>> = {
  "core.activity": {
    default: false,
    order: 90,
    async load(ctx, input) {
      const names = new Map(input.spaces.map((space) => [space.id, space.name]));
      const rows = await ctx.db.activityEvent.findMany({
        where: { spaceId: { in: [...names.keys()] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: ACTIVITY_LIMIT,
        include: activityInclude,
      });
      return {
        events: rows.map((row) => ({
          spaceId: row.spaceId,
          spaceName: names.get(row.spaceId) ?? "",
          event: toActivityEvent(ctx, row),
        })),
      };
    },
  },
};

interface Entry {
  key: string;
  widget: ApiWidget;
  /** Espaces ou le widget a du sens ; vide = widget indisponible. */
  spaces: ActiveSpace[];
}

/** Tous les widgets connus, dans l'ordre par defaut. */
function registry(ctx: Context): { key: string; widget: ApiWidget; module: string | null }[] {
  return [
    ...Object.entries(CORE_WIDGETS).map(([key, widget]) => ({ key, widget, module: null })),
    ...ctx.modules.flatMap((module) =>
      Object.entries(module.widgets ?? {}).map(([key, widget]) => ({
        key,
        widget,
        module: module.code,
      }))
    ),
  ].sort((a, b) => a.widget.order - b.widget.order);
}

function usable(ctx: Context, spaces: readonly ActiveSpace[]): Entry[] {
  return registry(ctx)
    .map(({ key, widget, module }) => ({
      key,
      widget,
      spaces: spaces.filter((space) =>
        module ? space.modules.has(module) : space.kind === "GROUP"
      ),
    }))
    .filter((entry) => entry.spaces.length > 0);
}

/** Cles inconnues du registre refusees a l'enregistrement. */
export function assertKnownWidgets(ctx: Context, keys: readonly string[]): void {
  const known = new Set(registry(ctx).map((entry) => entry.key));
  const unknown = keys.filter((key) => !known.has(key));
  if (unknown.length > 0 || new Set(keys).size !== keys.length) {
    throw new AppError("VALIDATION_001", [
      { location: "body", path: "homeWidgets", code: "custom", message: "unknown widget" },
    ]);
  }
}

export async function getHome(ctx: Context, userId: string): Promise<HomeResponse> {
  const [user, spaces] = await Promise.all([
    ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { homeWidgets: true } }),
    activeSpaces(ctx, userId),
  ]);
  const entries = usable(ctx, spaces);
  const chosen = Array.isArray(user.homeWidgets)
    ? user.homeWidgets.filter((key): key is string => typeof key === "string")
    : null;
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const shown = chosen
    ? chosen.flatMap((key) => byKey.get(key) ?? [])
    : entries.filter((entry) => entry.widget.default);
  const widgets = await Promise.all(
    shown.map(async (entry) => ({
      key: entry.key,
      data: await entry.widget.load(ctx, {
        userId,
        spaces: entry.spaces.map(({ id, name }) => ({ id, name })),
      }),
    }))
  );
  return {
    widgets,
    available: entries.map((entry) => ({ key: entry.key, default: entry.widget.default })),
    custom: chosen !== null,
  };
}
