// Envoi de fichiers comme le ferait le navigateur : ticket de l'API, puis
// formulaire multipart directement vers le stockage S3 de test [D167].
import { uploadTicketSchema, type UploadTicket } from "@fm/shared";

import type { Client } from "./app.ts";
import { webpBytes } from "./images.ts";

export async function postToStorage(
  ticket: UploadTicket,
  file: Buffer,
  contentType = "image/webp"
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append("Content-Type", contentType);
  form.append("file", new Blob([new Uint8Array(file)], { type: contentType }));
  return fetch(ticket.url, { method: "POST", body: form });
}

/** Envoie un fichier et renvoie l'identifiant de l'envoi (WebP 256 x 256 par defaut). */
export async function upload(client: Client, file: Buffer = webpBytes(256, 256)): Promise<string> {
  const res = await client.post("/uploads");
  if (res.status !== 201)
    throw new Error(`ticket refused: ${res.status} ${JSON.stringify(res.body)}`);
  const ticket = uploadTicketSchema.parse(res.body);
  const sent = await postToStorage(ticket, file);
  if (!sent.ok) throw new Error(`upload refused: ${sent.status} ${await sent.text()}`);
  return ticket.uploadId;
}

/** Contenu servi par une URL signee (null si refusee). */
export async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url);
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}
