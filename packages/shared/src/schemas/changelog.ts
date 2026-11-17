// Changelog (C6.6) [D187, D127] : versions preparees par la CI (release.json),
// reformulees et publiees par l'admin (A10), lues par les utilisateurs (Nouveautes).

import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const RELEASE_SECTIONS = ["features", "improvements", "fixes"] as const;
export type ReleaseSection = (typeof RELEASE_SECTIONS)[number];

export const RELEASE_TITLE_MAX = 120;
export const RELEASE_ITEM_MAX = 300;
export const RELEASE_ITEMS_MAX = 50;

export const releaseItemSchema = z.strictObject({
  text: z.string().trim().min(1).max(RELEASE_ITEM_MAX),
});
export type ReleaseItem = z.infer<typeof releaseItemSchema>;

const items = z.array(releaseItemSchema).max(RELEASE_ITEMS_MAX).default([]);

/** Nouveautes, Ameliorations, Corrections. */
export const releaseContentSchema = z.strictObject({
  features: items,
  improvements: items,
  fixes: items,
});
export type ReleaseContent = z.infer<typeof releaseContentSchema>;

export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

/** "2.10.0" apres "2.9.1" : comparaison numerique, pour `Array.sort`. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Fichier ecrit par la CI dans l'image API, lu par le seed. */
export const releaseFileSchema = z.object({
  version: semverSchema,
  content: releaseContentSchema,
});
export type ReleaseFile = z.infer<typeof releaseFileSchema>;

export const CHANGELOG_STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
export const changelogStatusSchema = z.enum(CHANGELOG_STATUSES);
export type ChangelogStatus = z.infer<typeof changelogStatusSchema>;

export const adminReleaseSchema = z.object({
  id: uuidSchema,
  version: z.string(),
  title: z.string(),
  content: releaseContentSchema,
  status: changelogStatusSchema,
  publishedAt: isoDateTimeSchema.nullable(),
  notifiedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type AdminRelease = z.infer<typeof adminReleaseSchema>;

export const updateReleaseBodySchema = z.strictObject({
  title: z.string().trim().min(1).max(RELEASE_TITLE_MAX),
  content: releaseContentSchema,
});
export type UpdateReleaseBody = z.infer<typeof updateReleaseBodySchema>;

export const publishReleaseBodySchema = z.strictObject({
  /** Prevenir tous les utilisateurs par une notification [D127]. */
  notify: z.boolean(),
});
export type PublishReleaseBody = z.infer<typeof publishReleaseBodySchema>;

/** Version publiee, vue par les utilisateurs (page Nouveautes). */
export const releaseSchema = z.object({
  version: z.string(),
  title: z.string(),
  content: releaseContentSchema,
  publishedAt: isoDateTimeSchema,
});
export type Release = z.infer<typeof releaseSchema>;
