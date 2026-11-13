// Stockage des photos dans la stack E2E. L'API signe ses URL pour l'adresse
// publique de production, la seule que la CSP du nginx laisse passer : le
// navigateur garde donc la CSP reelle, et ses requetes vers cette adresse sont
// servies ici par le RustFS de la stack (rien ne sort du reseau Docker).
import { request as httpRequest } from "node:http";
import { deflateSync } from "node:zlib";

import type { BrowserContext } from "@playwright/test";

/** `MINIO_PUBLIC_URL` de docker/compose.e2e.yml. */
export const STORAGE_PUBLIC_URL = "https://s3.matthias-bouloc.fr";
const STORAGE_HOST = "s3";
const STORAGE_PORT = 9000;

interface Forwarded {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

function forward(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | null
): Promise<Forwarded> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      { host: STORAGE_HOST, port: STORAGE_PORT, method, path, headers },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          const received: Record<string, string> = {};
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined)
              received[name] = Array.isArray(value) ? value.join(", ") : value;
          }
          resolve({
            status: incoming.statusCode ?? 502,
            headers: received,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    outgoing.on("error", reject);
    outgoing.end(body ?? undefined);
  });
}

/** Sert les requetes du navigateur vers le stockage public par le RustFS de la stack. */
export async function routeStorage(context: BrowserContext): Promise<void> {
  await context.route(`${STORAGE_PUBLIC_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataBuffer();
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(await request.allHeaders())) {
      if (!name.startsWith(":") && name !== "content-length") headers[name] = value;
    }
    // La signature des URL de lecture couvre l'hote public.
    headers.host = url.host;
    if (body) headers["content-length"] = String(body.length);
    const response = await forward(request.method(), url.pathname + url.search, headers, body);
    // Lecture entre origines (envoi par `fetch`) : comme le stockage de production.
    response.headers["access-control-allow-origin"] = "*";
    await route.fulfill(response);
  });
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** Photo de test : un PNG uni, a donner a un champ de fichier. */
export function photoFile(name = "photo.png", side = 64) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RVB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(side * 3, 0xb4)]);
  const pixels = Buffer.concat(Array.from({ length: side }, () => row));
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return { name, mimeType: "image/png", buffer };
}

/** Noms des fichiers d'une archive zip (lus dans son repertoire central). */
export function zipEntries(archive: Buffer): string[] {
  const names: string[] = [];
  let offset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (offset >= 0 && archive.readUInt32LE(offset) === 0x02014b50) {
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    names.push(archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
    if (offset + 4 > archive.length) break;
  }
  return names;
}
