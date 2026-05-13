import { z } from "zod";
import { CHANGELOG_003, CHANGELOG_004 } from "../../constants/errorCodes";

const semverRegex = /^\d+\.\d+\.\d+$/;

const changelogItemSchema = z.object({
  text: z.string().min(1).max(500),
});

const changelogContentSchema = z
  .object({
    features: z.array(changelogItemSchema).default([]),
    improvements: z.array(changelogItemSchema).default([]),
    fixes: z.array(changelogItemSchema).default([]),
  })
  .refine((c) => c.features.length > 0 || c.improvements.length > 0 || c.fixes.length > 0, {
    message: CHANGELOG_003,
  });

export const adminCreateChangelogSchema = z.object({
  version: z.string().regex(semverRegex, CHANGELOG_004),
  title: z.string().min(1).max(200),
  content: changelogContentSchema,
  publishedAt: z.coerce.date().optional(),
});

export const adminUpdateChangelogSchema = z.object({
  version: z.string().regex(semverRegex, CHANGELOG_004).optional(),
  title: z.string().min(1).max(200).optional(),
  content: changelogContentSchema.optional(),
  publishedAt: z.coerce.date().optional(),
});

export type AdminCreateChangelogInput = z.infer<typeof adminCreateChangelogSchema>;
export type AdminUpdateChangelogInput = z.infer<typeof adminUpdateChangelogSchema>;
