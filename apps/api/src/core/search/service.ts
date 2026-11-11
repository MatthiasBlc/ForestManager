// Recherche globale (P16) [D119, D191] : le socle cherche les espaces et les
// membres, chaque module ses propres groupes (aucun module code ici [D40]).
import { normalizeName, SEARCH_GROUP_LIMIT, type SearchGroup, type SearchQuery } from "@fm/shared";

import type { Context } from "../context.ts";
import { Prisma } from "../db/client.ts";
import type { SearchInput, SearchSpace } from "./types.ts";

interface ActiveSpace extends SearchSpace {
  kind: "PERSONAL" | "GROUP";
  modules: Set<string>;
}

/** Espaces ou l'utilisateur est membre actif, avec leurs modules actifs. */
async function activeSpaces(ctx: Context, userId: string): Promise<ActiveSpace[]> {
  const rows = await ctx.db.space.findMany({
    where: { deletedAt: null, memberships: { some: { userId, leftAt: null } } },
    select: {
      id: true,
      name: true,
      kind: true,
      modules: {
        where: {
          enabled: true,
          revokedAt: null,
          module: { status: { in: ["AVAILABLE", "BETA"] } },
        },
        select: { moduleCode: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    modules: new Set(row.modules.map((m) => m.moduleCode)),
  }));
}

function escapeLike(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function searchSpaces(spaces: readonly ActiveSpace[], text: string, limit: number) {
  return spaces
    .filter((space) => space.kind === "GROUP" && normalizeName(space.name).includes(text))
    .slice(0, limit)
    .map((space) => ({
      id: space.id,
      title: space.name,
      spaceId: space.id,
      spaceName: space.name,
      data: {},
    }));
}

async function searchMembers(ctx: Context, input: SearchInput, spaces: readonly ActiveSpace[]) {
  const groups = spaces.filter((space) => space.kind === "GROUP");
  if (groups.length === 0) return [];
  const ids = Prisma.join(groups.map((space) => space.id));
  const rows = await ctx.db.$queryRaw<{ id: string; username: string; spaceId: string }[]>`
    SELECT id, username, "spaceId" FROM (
      SELECT DISTINCT ON (u.id) u.id, u.username, m."spaceId",
        (lower(unaccent(u.username)) LIKE ${input.text.replace(/[\\%_]/g, (c) => `\\${c}`)} || '%') AS prefix
      FROM "Membership" m
      JOIN "User" u ON u.id = m."userId"
      JOIN "Space" s ON s.id = m."spaceId"
      WHERE m."spaceId" IN (${ids}) AND m."leftAt" IS NULL AND u."deletedAt" IS NULL
        AND u.id <> ${input.userId} AND lower(unaccent(u.username)) LIKE ${input.like}
      ORDER BY u.id, (m."spaceId" = ${input.currentSpaceId}) DESC, s.name
    ) found
    ORDER BY prefix DESC, lower(username)
    LIMIT ${input.limit}`;
  const names = new Map(groups.map((space) => [space.id, space.name]));
  return rows.map((row) => ({
    id: row.id,
    title: row.username,
    spaceId: row.spaceId,
    spaceName: names.get(row.spaceId) ?? "",
    data: {},
  }));
}

export async function search(
  ctx: Context,
  userId: string,
  query: SearchQuery
): Promise<SearchGroup[]> {
  const text = normalizeName(query.q);
  const spaces = await activeSpaces(ctx, userId);
  const personal = spaces.find((space) => space.kind === "PERSONAL");
  const current =
    spaces.find((space) => space.id === query.spaceId)?.id ?? personal?.id ?? spaces[0]?.id;
  if (!current) return [];
  const base: Omit<SearchInput, "spaces"> = {
    userId,
    text,
    like: escapeLike(text),
    currentSpaceId: current,
    limit: SEARCH_GROUP_LIMIT,
  };

  const moduleGroups = await Promise.all(
    ctx.modules.map(async (module) => {
      if (!module.search) return [];
      const enabled = spaces.filter((space) => space.modules.has(module.code));
      if (enabled.length === 0) return [];
      const groups = await module.search(ctx, {
        ...base,
        spaces: enabled.map(({ id, name }) => ({ id, name })),
      });
      return groups.filter((group) => group.key.startsWith(`${module.code}.`));
    })
  );
  const groups: SearchGroup[] = [
    ...moduleGroups.flat(),
    { key: "core.members", items: await searchMembers(ctx, { ...base, spaces }, spaces) },
    { key: "core.spaces", items: searchSpaces(spaces, text, base.limit) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
