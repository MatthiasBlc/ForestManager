// Photos et avatars [D146, D167] : envoi direct du navigateur vers le stockage
// par un formulaire signe (POST), puis rattachement a la recette, au compte ou
// a l'espace par l'identifiant de l'envoi.
import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";

/** Taille maximale d'un fichier envoye (WebP, ou JPEG sur Safari, converti dans le navigateur). */
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

/** Plus grand cote accepte, et celui vise par la conversion du navigateur. */
export const IMAGE_MAX_SIDE = { photo: 2048, avatar: 512 } as const;

/**
 * Formulaire signe : `fields`, puis `Content-Type` (type du fichier converti),
 * puis le fichier (champ `file`, en dernier) en multipart vers `url`.
 */
export const uploadTicketSchema = z.object({
  uploadId: uuidSchema,
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  maxBytes: z.number().int(),
  expiresAt: isoDateTimeSchema,
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;

/** Rattacher un envoi termine (photo de recette, avatar). */
export const attachImageBodySchema = z.strictObject({ uploadId: uuidSchema });
export type AttachImageBody = z.infer<typeof attachImageBodySchema>;

/** URL signee de courte duree de l'image rattachee, ou null apres un retrait. */
export const imageResponseSchema = z.object({ url: z.string().nullable() });
export type ImageResponse = z.infer<typeof imageResponseSchema>;
