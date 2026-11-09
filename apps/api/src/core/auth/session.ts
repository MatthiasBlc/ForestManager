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
    /**
     * Connecte avec un mot de passe temporaire (id du jeton) : la session ne sert
     * qu'a choisir un nouveau mot de passe [D134].
     */
    passwordChoice?: string;
    /** Session admin (cookie distinct) [D174]. */
    adminId?: string;
    /** Code TOTP valide : la session admin est complete. */
    adminVerified?: boolean;
    totpAttempts?: number;
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

/** Acces a une table de sessions (utilisateurs ou admins) [D174]. */
export interface SessionRows {
  find(sid: string): Promise<{ data: string; expiresAt: Date } | null>;
  save(sid: string, data: string, expiresAt: Date, session: session.SessionData): Promise<unknown>;
  remove(sid: string): Promise<unknown>;
  extend(sid: string, expiresAt: Date): Promise<unknown>;
}

/** Sessions des utilisateurs : la colonne userId ferme toutes celles d'un compte. */
export function userSessionRows(db: Db): SessionRows {
  return {
    find: (sid) => db.userSession.findUnique({ where: { sid } }),
    save: (sid, data, expires, value) => {
      const values = { data, expiresAt: expires, userId: value.userId ?? null };
      return db.userSession.upsert({
        where: { sid },
        create: { id: sid, sid, ...values },
        update: values,
      });
    },
    remove: (sid) => db.userSession.deleteMany({ where: { sid } }),
    extend: (sid, expires) =>
      db.userSession.updateMany({ where: { sid }, data: { expiresAt: expires } }),
  };
}

export class DbSessionStore extends session.Store {
  private readonly rows: SessionRows;

  constructor(rows: SessionRows) {
    super();
    this.rows = rows;
  }

  override get(
    sid: string,
    callback: (error: unknown, data?: session.SessionData | null) => void
  ): void {
    this.rows
      .find(sid)
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
    this.rows
      .save(sid, JSON.stringify(data), expiresAt(data), data)
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: Callback): void {
    this.rows
      .remove(sid)
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(sid: string, data: session.SessionData, callback?: Callback): void {
    this.rows
      .extend(sid, expiresAt(data))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }
}

export function sessionMiddleware(db: Db, secret: string, secure: boolean): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret,
    store: new DbSessionStore(userSessionRows(db)),
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
