// Envoi d'une image [D167] : conversion, ticket de l'API, puis formulaire
// multipart signe directement vers le stockage. Renvoie l'identifiant de
// l'envoi, a rattacher ensuite (photo de recette, avatar).
import { ERRORS, IMAGE_MAX_SIDE, uploadTicketSchema } from "@fm/shared";

import { api, ApiRequestError } from "./api.ts";
import { convertImage } from "./image.ts";

export type ImageKind = keyof typeof IMAGE_MAX_SIDE;

export async function uploadImage(file: Blob, kind: ImageKind): Promise<string> {
  const image = await convertImage(file, IMAGE_MAX_SIDE[kind]);
  const ticket = await api.post("/uploads", undefined, uploadTicketSchema);
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append("Content-Type", image.type);
  form.append("file", image); // toujours en dernier
  let res: Response;
  try {
    res = await fetch(ticket.url, { method: "POST", body: form });
  } catch {
    throw new ApiRequestError("NETWORK", 0, "Connexion impossible. Vérifie ton réseau.");
  }
  if (!res.ok) {
    throw new ApiRequestError("STORAGE_003", res.status, ERRORS.STORAGE_003.message);
  }
  return ticket.uploadId;
}
