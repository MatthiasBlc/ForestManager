// Modules d'un espace : catalogue, demandes d'acces, activation, ordre [D33, D124, D131].

import { z } from "zod";

import { moduleCodeSchema, moduleStatusSchema } from "../modules/index.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const MODULE_REQUEST_MESSAGE_MAX = 500;

export const spaceModuleParamsSchema = z.strictObject({
  spaceId: uuidSchema,
  moduleCode: moduleCodeSchema,
});

export const moduleAccessRequestBodySchema = z.strictObject({
  message: z.string().trim().max(MODULE_REQUEST_MESSAGE_MAX).optional(),
});

export const setModuleEnabledBodySchema = z.strictObject({ enabled: z.boolean() });

/** Ordre complet des modules accordes de l'espace [D131]. */
export const reorderModulesBodySchema = z.strictObject({
  codes: z
    .array(moduleCodeSchema)
    .min(1)
    .max(50)
    .refine((codes) => new Set(codes).size === codes.length, { message: "duplicate codes" }),
});

export const accessRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export const moduleAccessRequestSchema = z.object({
  id: uuidSchema,
  moduleCode: z.string(),
  status: accessRequestStatusSchema,
  message: z.string().nullable(),
  /** Motif du refus, visible par l'OWNER [D124]. */
  decisionNote: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  decidedAt: isoDateTimeSchema.nullable(),
});
export type ModuleAccessRequest = z.infer<typeof moduleAccessRequestSchema>;

/** Une ligne du catalogue vue depuis un espace (D54 : lisible par tous les membres). */
export const catalogModuleSchema = z.object({
  code: z.string(),
  status: moduleStatusSchema,
  isDefault: z.boolean(),
  granted: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  /** Derniere demande de l'espace pour ce module (en attente ou refusee), sinon null. */
  lastRequest: moduleAccessRequestSchema.nullable(),
});
export type CatalogModule = z.infer<typeof catalogModuleSchema>;
