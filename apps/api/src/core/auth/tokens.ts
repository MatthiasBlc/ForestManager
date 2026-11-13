// Jetons a usage unique envoyes par email [D21] : 256 bits aleatoires, seul le
// hash SHA-256 est stocke. Un nouveau jeton du meme type remplace les anciens.
import { createHash, randomBytes } from "node:crypto";

import type { Db } from "../db/client.ts";

export type EmailTokenKind = "VERIFY_EMAIL" | "RESET_PASSWORD";

export const TOKEN_TTL_MS: Record<EmailTokenKind, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(db: Db, userId: string, kind: EmailTokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, kind, usedAt: null } }),
    db.authToken.create({
      data: {
        userId,
        kind,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]),
      },
    }),
  ]);
  return token;
}

/**
 * Consomme un jeton valable : renvoie l'utilisateur, ou null si le jeton est
 * inconnu, expire ou deja utilise. `beforeUse` peut refuser (en levant une
 * erreur) sans bruler le jeton. Le marquage est atomique (pas de double usage).
 */
export async function consumeToken(
  db: Db,
  token: string,
  kind: EmailTokenKind,
  beforeUse?: (userId: string) => Promise<void>
): Promise<string | null> {
  const row = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  await beforeUse?.(row.userId);
  const { count } = await db.authToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return count === 1 ? row.userId : null;
}
