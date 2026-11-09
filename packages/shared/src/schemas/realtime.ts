// Evenements du flux temps reel GET /events (SSE) [D188]. Ils ne portent que des
// identifiants : le client relit les donnees concernees.

import { z } from "zod";

import { uuidSchema } from "./common.ts";

export const realtimeEventSchema = z.discriminatedUnion("type", [
  /** Nouvelle notification (ou regroupee) : compteur et centre a relire. */
  z.object({ type: z.literal("notification") }),
  /** Ecriture dans un espace : `module` null pour le socle (membres, reglages...). */
  z.object({ type: z.literal("invalidate"), spaceId: uuidSchema, module: z.string().nullable() }),
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
