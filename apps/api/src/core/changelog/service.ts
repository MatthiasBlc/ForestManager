// Changelog (C6.6) [D187, D127, D190] : brouillon cree au demarrage depuis
// release.json, versions de l'admin (A10, chaque action auditee [D128]) et
// versions publiees des utilisateurs (Nouveautes).

import { readFileSync } from "node:fs";

import {
  compareVersions,
  releaseContentSchema,
  releaseFileSchema,
  type AdminRelease,
  type ChangelogStatus,
  type Release,
  type ReleaseContent,
  type ReleaseFile,
  type UpdateReleaseBody,
} from "@fm/shared";

import { audit } from "../admin/audit.ts";
import type { Context } from "../context.ts";
import type { Db, Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { catalogOf } from "../notifications/service.ts";

/** Ecrit par la CI dans le contexte de l'image API (absent en dev et en test). */
export const RELEASE_FILE = new URL("../../../release.json", import.meta.url);

const RELEASE_TYPE = "core.release.published";
const RELEASE_CATEGORY = "core.releases";
const EMPTY: ReleaseContent = { features: [], improvements: [], fixes: [] };

/** release.json valide, ou null s'il manque ; un fichier illisible fait echouer le demarrage. */
export function readReleaseFile(file: URL = RELEASE_FILE): ReleaseFile | null {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  return releaseFileSchema.parse(JSON.parse(raw));
}

/** Creation seule : une version existante (deja reformulee) n'est jamais ecrasee. */
export async function seedRelease(db: Db, release: ReleaseFile | null): Promise<void> {
  if (!release) return;
  await db.changelogEntry.upsert({
    where: { version: release.version },
    create: {
      version: release.version,
      title: `Version ${release.version}`,
      content: release.content,
    },
    update: {},
  });
}

type Row = Prisma.ChangelogEntryGetPayload<object>;

function contentOf(row: Row): ReleaseContent {
  const parsed = releaseContentSchema.safeParse(row.content);
  return parsed.success ? parsed.data : EMPTY;
}

function toAdmin(row: Row): AdminRelease {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    content: contentOf(row),
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Admin (A10) ---

export async function listReleases(ctx: Context): Promise<AdminRelease[]> {
  const rows = await ctx.db.changelogEntry.findMany();
  return rows.sort((a, b) => compareVersions(b.version, a.version)).map(toAdmin);
}

async function findRelease(ctx: Context, id: string): Promise<Row> {
  const row = await ctx.db.changelogEntry.findUnique({ where: { id } });
  if (!row) throw new AppError("CHANGELOG_001");
  return row;
}

interface Transition {
  from: readonly ChangelogStatus[];
  action: string;
  data: (row: Row) => Prisma.ChangelogEntryUpdateManyMutationInput;
  /** Ecritures de la meme transaction, apres le changement d'etat. */
  after?: (tx: Prisma.TransactionClient, row: Row) => Promise<void>;
}

/**
 * Applique le changement si la version est dans l'un des etats attendus
 * (CHANGELOG_002 sinon, y compris si un autre admin vient de la changer).
 */
async function transition(
  ctx: Context,
  adminId: string,
  id: string,
  change: Transition
): Promise<AdminRelease> {
  const row = await findRelease(ctx, id);
  if (!change.from.includes(row.status)) throw new AppError("CHANGELOG_002");
  const data = change.data(row);
  const updated = await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.changelogEntry.updateMany({
      where: { id, status: row.status },
      data,
    });
    if (count === 0) throw new AppError("CHANGELOG_002");
    await change.after?.(tx, row);
    await audit(tx, {
      adminId,
      action: change.action,
      targetType: "ChangelogEntry",
      targetId: id,
      data: { version: row.version },
    });
    return tx.changelogEntry.findUniqueOrThrow({ where: { id } });
  });
  return toAdmin(updated);
}

export function updateRelease(
  ctx: Context,
  adminId: string,
  id: string,
  body: UpdateReleaseBody
): Promise<AdminRelease> {
  return transition(ctx, adminId, id, {
    from: ["DRAFT", "PUBLISHED"],
    action: "release.updated",
    data: () => ({ title: body.title, content: body.content }),
  });
}

/** Utilisateurs actifs qui gardent la categorie "Nouveautes" (preference globale). */
async function releaseReaders(tx: Prisma.TransactionClient, ctx: Context): Promise<string[]> {
  const enabledByDefault = catalogOf(ctx).category(RELEASE_CATEGORY)?.defaultEnabled ?? true;
  const preference = { category: RELEASE_CATEGORY, spaceId: null, enabled: !enabledByDefault };
  const users = await tx.user.findMany({
    where: {
      deletedAt: null,
      notificationPrefs: enabledByDefault ? { none: preference } : { some: preference },
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function publishRelease(
  ctx: Context,
  adminId: string,
  id: string,
  notify: boolean
): Promise<AdminRelease> {
  let readers: string[] = [];
  const now = new Date();
  const release = await transition(ctx, adminId, id, {
    from: ["DRAFT"],
    action: "release.published",
    data: (row) => {
      const content = contentOf(row);
      if (content.features.length + content.improvements.length + content.fixes.length === 0) {
        throw new AppError("CHANGELOG_003");
      }
      return { status: "PUBLISHED", publishedAt: now, notifiedAt: notify ? now : null };
    },
    after: async (tx, row) => {
      if (!notify) return;
      readers = await releaseReaders(tx, ctx);
      // Une ligne par utilisateur, en une requete [D190].
      await tx.notification.createMany({
        data: readers.map((userId) => ({
          userId,
          type: RELEASE_TYPE,
          category: RELEASE_CATEGORY,
          data: { version: row.version, title: row.title },
          url: "/news",
        })),
      });
    },
  });
  ctx.realtime.toUsers(readers, { type: "notification" });
  return release;
}

export function hideRelease(ctx: Context, adminId: string, id: string): Promise<AdminRelease> {
  return transition(ctx, adminId, id, {
    from: ["PUBLISHED"],
    action: "release.hidden",
    data: () => ({ status: "HIDDEN" }),
  });
}

/** Reafficher ne previent personne une seconde fois. */
export function showRelease(ctx: Context, adminId: string, id: string): Promise<AdminRelease> {
  return transition(ctx, adminId, id, {
    from: ["HIDDEN"],
    action: "release.shown",
    data: () => ({ status: "PUBLISHED" }),
  });
}

// --- Utilisateurs (Nouveautes) ---

export async function publishedReleases(ctx: Context): Promise<Release[]> {
  const rows = await ctx.db.changelogEntry.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map((row) => ({
    version: row.version,
    title: row.title,
    content: contentOf(row),
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  }));
}
