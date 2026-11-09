// Notifications et activite [F-NOT-1 a F-NOT-3, D41] : catalogue fusionne du
// socle et des modules, schemas des routes /me/notifications.

import { z } from "zod";

import type { ModuleDefinition } from "../modules/index.ts";
import { isoDateTimeSchema, userSummarySchema, uuidSchema } from "../schemas/common.ts";
import {
  CORE_ACTIVITY_TYPES,
  CORE_NOTIFICATION_CATEGORIES,
  CORE_NOTIFICATION_TYPES,
  type NotificationCategoryDefinition,
} from "./core.ts";

export * from "./core.ts";

export interface NotificationCategory {
  key: string;
  /** null pour une categorie du socle. */
  moduleCode: string | null;
  defaultEnabled: boolean;
  mandatory: boolean;
  perSpace: boolean;
}

export interface NotificationCatalog {
  /** Categorie d'un type declare, ou null s'il est inconnu. */
  typeCategory: (type: string) => string | null;
  category: (key: string) => NotificationCategory | null;
  isActivityType: (type: string) => boolean;
  /** Categories qu'un utilisateur peut couper : socle d'abord, puis modules dans l'ordre. */
  configurable: () => NotificationCategory[];
}

type NotificationModule = Pick<
  ModuleDefinition,
  "code" | "notificationCategories" | "notificationTypes" | "activityTypes"
>;

function toCategory(
  key: string,
  moduleCode: string | null,
  definition: NotificationCategoryDefinition
): NotificationCategory {
  return {
    key,
    moduleCode,
    defaultEnabled: definition.defaultEnabled ?? true,
    mandatory: definition.mandatory ?? false,
    perSpace: definition.perSpace ?? true,
  };
}

/** Catalogue du socle et des modules (manifestes deja valides au demarrage). */
export function notificationCatalog(modules: readonly NotificationModule[]): NotificationCatalog {
  const categories = new Map<string, NotificationCategory>();
  const types = new Map<string, string>();
  const activity = new Set<string>(CORE_ACTIVITY_TYPES);
  for (const [key, definition] of Object.entries(CORE_NOTIFICATION_CATEGORIES)) {
    categories.set(key, toCategory(key, null, definition));
  }
  for (const [type, definition] of Object.entries(CORE_NOTIFICATION_TYPES)) {
    types.set(type, definition.category);
  }
  for (const module of modules) {
    for (const [key, definition] of Object.entries(module.notificationCategories ?? {})) {
      categories.set(key, toCategory(key, module.code, definition));
    }
    for (const [type, definition] of Object.entries(module.notificationTypes ?? {})) {
      types.set(type, definition.category);
    }
    for (const type of module.activityTypes ?? []) activity.add(type);
  }
  return {
    typeCategory: (type) => types.get(type) ?? null,
    category: (key) => categories.get(key) ?? null,
    isActivityType: (type) => activity.has(type),
    configurable: () => [...categories.values()].filter((category) => !category.mandatory),
  };
}

// --- Schemas des routes ---

const notificationKeySchema = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/);

export const notificationParamsSchema = z.strictObject({ notificationId: uuidSchema });

export const notificationSchema = z.object({
  id: uuidSchema,
  type: z.string(),
  category: z.string(),
  space: z.object({ id: uuidSchema, name: z.string(), tintIndex: z.number().int() }).nullable(),
  actor: userSummarySchema.nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  /** Parametres du message, traduit cote client [D34]. */
  data: z.record(z.string(), z.unknown()).nullable(),
  /** Evenements regroupes dans cette notification ("Sam et 2 autres"). */
  count: z.number().int().min(1),
  url: z.string().nullable(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

export const unreadCountSchema = z.object({ count: z.number().int().min(0) });

const categoryPreferenceSchema = z.object({
  key: z.string(),
  moduleCode: z.string().nullable(),
  enabled: z.boolean(),
});
export type CategoryPreference = z.infer<typeof categoryPreferenceSchema>;

/** Preferences : globales, puis par espace (`custom` faux = comme les globales) [D118]. */
export const notificationPreferencesSchema = z.object({
  categories: z.array(categoryPreferenceSchema),
  spaces: z.array(
    z.object({
      spaceId: uuidSchema,
      custom: z.boolean(),
      categories: z.array(categoryPreferenceSchema),
    })
  ),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferenceBodySchema = z.strictObject({
  category: notificationKeySchema,
  enabled: z.boolean(),
});

/** Reglage personnalise d'un espace : toutes ses categories d'un coup. */
export const updateSpaceNotificationPreferencesBodySchema = z.strictObject({
  categories: z.record(notificationKeySchema, z.boolean()),
});

export const notificationSpaceParamsSchema = z.strictObject({ spaceId: uuidSchema });

// --- Fil d'activite d'un espace (F-SPC-7) ---

export const activityEventSchema = z.object({
  id: uuidSchema,
  type: z.string(),
  moduleCode: z.string().nullable(),
  /** null si le compte a ete supprime. */
  actor: userSummarySchema.nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoDateTimeSchema,
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;
