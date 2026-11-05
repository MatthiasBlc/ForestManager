// Sessions serveur en base [D13] : cookie httpOnly, 1 jour glissant, 30 jours
// avec "rester connecte". Store maison sur la table UserSession (la V1 utilisait
// @quixo3/prisma-session-store) : la colonne userId permet de fermer toutes les
// sessions d'un compte (changement de mot de passe, suppression).

import type { Request, RequestHandler } from "express";
import session from "express-session";

import type { Db } from "../db/client.ts";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export const SESSION_COOKIE = "fm.sid";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = DAY_MS;
export const REMEMBER_ME_TTL_MS = 30 * DAY_MS;

type Callback = (error?: unknown) => void;

function expiresAt(data: session.SessionData): Date {
  return new Date(Date.now() + (data.cookie.maxAge ?? SESSION_TTL_MS));
}

export class DbSessionStore extends session.Store {
  private readonly db: Db;

  constructor(db: Db) {
    super();
    this.db = db;
  }

  override get(
    sid: string,
    callback: (error: unknown, data?: session.SessionData | null) => void
  ): void {
    this.db.userSession
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row || row.expiresAt.getTime() <= Date.now()) {
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(row.data) as session.SessionData);
      })
      .catch(callback);
  }

  override set(sid: string, data: session.SessionData, callback?: Callback): void {
    const values = {
      data: JSON.stringify(data),
      expiresAt: expiresAt(data),
      userId: data.userId ?? null,
    };
    this.db.userSession
      .upsert({ where: { sid }, create: { id: sid, sid, ...values }, update: values })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: Callback): void {
    this.db.userSession
      .deleteMany({ where: { sid } })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(sid: string, data: session.SessionData, callback?: Callback): void {
    this.db.userSession
      .updateMany({ where: { sid }, data: { expiresAt: expiresAt(data) } })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }
}

export function sessionMiddleware(db: Db, secret: string, secure: boolean): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret,
    store: new DbSessionStore(db),
    resave: false,
    saveUninitialized: false,
    // Glissant : chaque reponse repousse l'expiration de la duree choisie.
    rolling: true,
    proxy: secure,
    cookie: { httpOnly: true, secure, sameSite: "lax", maxAge: SESSION_TTL_MS },
  });
}

/** Ferme les sessions d'un compte, sauf eventuellement la session courante. */
export async function destroyUserSessions(
  db: Db,
  userId: string,
  exceptSid?: string
): Promise<void> {
  await db.userSession.deleteMany({
    where: { userId, ...(exceptSid ? { sid: { not: exceptSid } } : {}) },
  });
}

export async function purgeExpiredSessions(db: Db): Promise<number> {
  const { count } = await db.userSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}

/** Rotation de l'identifiant a la connexion (fixation de session). */
export function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error)
        reject(error instanceof Error ? error : new Error("session error", { cause: error }));
      else resolve();
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => {
      if (error)
        reject(error instanceof Error ? error : new Error("session error", { cause: error }));
      else resolve();
    });
  });
}
