import express, { NextFunction, Request, Response } from "express";
import recipesRoutes from "./routes/recipes";
import userRoutes from "./routes/users";
import communitiesRoutes from "./routes/communities";
import adminAuthRoutes from "./admin/routes/authRoutes";
import morgan from "morgan";
import createHttpError, { isHttpError } from "http-errors";
import cors from "cors";
import session from "express-session";
import env from "./util/validateEnv";
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { requireAuth } from "./middleware/auth";
import prisma from "./util/db";

const app = express();

// cors needed for dev environment
app.use(cors({ credentials: true, origin: env.CORS_ORIGIN }));

app.use(morgan("dev"));

app.use(express.json());

// User session middleware (cookie: connect.sid, duree: 1h)
const userSession = session({
  name: "connect.sid",
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
  store: new PrismaSessionStore(prisma as any, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
  }),
});

// Admin session middleware (cookie: admin.sid, duree: 30min)
const adminSession = session({
  name: "admin.sid",
  secret: env.ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  },
  rolling: false, // Pas de renouvellement automatique pour admin
  store: new PrismaSessionStore(prisma as any, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
    sessionModelName: "AdminSession",
  }),
});

// Health check endpoint (before auth, no logging)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// User routes (avec user session)
app.use("/api/users", userSession, userRoutes);
app.use("/api/recipes", userSession, requireAuth, recipesRoutes);
app.use("/api/communities", userSession, requireAuth, communitiesRoutes);

// Admin routes (avec admin session isolee)
app.use("/api/admin/auth", adminSession, adminAuthRoutes);

app.use((req, res, next) => {
  next(createHttpError(404, "Endpoint not found"));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(error);
  let errorMessage = "An unknown error occurred";
  let statusCode = 500;
  if (isHttpError(error)) {
    statusCode = error.status;
    errorMessage = error.message;
  }
  res.status(statusCode).json({ error: errorMessage });
});

export default app;