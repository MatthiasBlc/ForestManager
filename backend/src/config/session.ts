import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import env from "../util/validateEnv";
import prisma from "../util/db";

/** User session (cookie: forestmanager_user_session, duree: 1h) */
export const userSession = session({
  name: "forestmanager_user_session",
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1 hour
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  },
  rolling: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: new PrismaSessionStore(prisma as any, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
  }),
});

/** Admin session (cookie: forestmanager_admin_session, duree: 30min) */
export const adminSession = session({
  name: "forestmanager_admin_session",
  secret: env.ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  },
  rolling: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: new PrismaSessionStore(prisma as any, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
    sessionModelName: "AdminSession",
  }),
});
