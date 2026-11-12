// Curseur opaque des listes triees par date decroissante puis identifiant
// (notifications, activite) [D72].
import { AppError } from "./errors.ts";

export interface DateCursor {
  createdAt: Date;
  id: string;
}

export function encodeDateCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString("base64url");
}

export function decodeDateCursor(raw: string): DateCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
      const createdAt = new Date(parsed[0]);
      if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: parsed[1] };
    }
  } catch {
    // curseur illisible : refuse ci-dessous
  }
  throw new AppError("VALIDATION_001", [
    { location: "query", path: "cursor", code: "custom", message: "Curseur invalide" },
  ]);
}

/** Condition Prisma "apres le curseur" pour un tri (createdAt desc, id desc). */
export function afterDateCursor(cursor: DateCursor | null) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
