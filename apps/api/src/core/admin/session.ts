// Session admin, isolee de celle des utilisateurs [D174] : cookie distinct limite
// aux routes /api/v1/admin, table AdminSession, 30 minutes non glissantes depuis
// la validation du code TOTP (CDC S3.3). L'etape mot de passe ouvre une session
// d'attente de 5 minutes, qui ne donne acces qu'a la saisie du code.

import { ADMIN_SESSION_MINUTES, API_PREFIX } from "@fm/shared";
import type { Request, RequestHandler } from "express";
import session from "express-session";

import { DbSessionStore, type SessionRows } from "../auth/session.ts";
import type { Db } from "../db/client.ts";
import { AppError } from "../http/errors.ts";

export const ADMIN_SESSION_COOKIE = "fm.admin.sid";
export const ADMIN_COOKIE_PATH = `${API_PREFIX}/admin`;
export const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_MINUTES * 60 * 1000;
/** Entre le mot de passe et le code. */
export const ADMIN_PENDING_TTL_MS = 5 * 60 * 1000;

function adminSessionRows(db: Db): SessionRows {
  return {
    find: (sid) => db.adminSession.findUnique({ where: { sid } }),
    save: (sid, data, expiresAt) =>
      db.adminSession.upsert({
        where: { sid },
        create: { id: sid, sid, data, expiresAt },
        update: { data, expiresAt },
      }),
    remove: (sid) => db.adminSession.deleteMany({ where: { sid } }),
    // Non glissante : une requete ne repousse jamais l'expiration.
    extend: () => Promise.resolve(),
  };
}

export function adminSessionMiddleware(db: Db, secret: string, secure: boolean): RequestHandler {
  return session({
    name: ADMIN_SESSION_COOKIE,
    secret,
    store: new DbSessionStore(adminSessionRows(db)),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: secure,
    cookie: {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: ADMIN_COOKIE_PATH,
      maxAge: ADMIN_PENDING_TTL_MS,
    },
  });
}

export async function purgeExpiredAdminSessions(db: Db): Promise<number> {
  const { count } = await db.adminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}

/** Garde des routes admin : mot de passe et code TOTP valides. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.session.adminId || req.session.adminVerified !== true) throw new AppError("ADMIN_002");
  next();
};

/** Admin de la session ; a appeler derriere requireAdmin. */
export function currentAdminId(req: Request): string {
  const { adminId } = req.session;
  if (!adminId || req.session.adminVerified !== true) throw new AppError("ADMIN_002");
  return adminId;
}
