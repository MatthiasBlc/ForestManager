// Recherche globale (P16, F-RECHERCHE) [D119, D191] : un appel, des groupes
// fournis par le socle et les modules. Le client traduit les groupes et compose
// les liens (comme les notifications [D34]).

import { z } from "zod";

import { uuidSchema } from "./common.ts";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_GROUP_LIMIT = 5;

export const searchQuerySchema = z.strictObject({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(100),
  /** Espace courant : ses resultats passent devant, il porte les ingredients. */
  spaceId: uuidSchema.optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Espace ou ouvrir le resultat. */
  spaceId: uuidSchema,
  spaceName: z.string(),
  /** Details propres au groupe (base, nombre de recettes, date du repas...). */
  data: z.record(z.string(), z.unknown()),
});
export type SearchItem = z.infer<typeof searchItemSchema>;

export const searchGroupSchema = z.object({
  /** `core.<nom>` ou `<module>.<nom>`. */
  key: z.string(),
  items: z.array(searchItemSchema),
});
export type SearchGroup = z.infer<typeof searchGroupSchema>;

export const searchResponseSchema = z.object({ groups: z.array(searchGroupSchema) });
export type SearchResponse = z.infer<typeof searchResponseSchema>;
