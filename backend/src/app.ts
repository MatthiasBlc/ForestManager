import express, { NextFunction, Request, Response } from "express";
import authRoutes from "./routes/auth";
import recipesRoutes from "./routes/recipes";
import tagsRoutes from "./routes/tags";
import ingredientsRoutes from "./routes/ingredients";
import communitiesRoutes from "./routes/communities";
import invitesRoutes from "./routes/invites";
import usersRoutes from "./routes/users";
import proposalsRoutes from "./routes/proposals";
import tagSuggestionsRoutes from "./routes/tagSuggestions";
import adminAuthRoutes from "./admin/routes/authRoutes";
import adminTagsRoutes from "./admin/routes/tagsRoutes";
import adminIngredientsRoutes from "./admin/routes/ingredientsRoutes";
import adminCommunitiesRoutes from "./admin/routes/communitiesRoutes";
import adminFeaturesRoutes from "./admin/routes/featuresRoutes";
import adminDashboardRoutes from "./admin/routes/dashboardRoutes";
import adminActivityRoutes from "./admin/routes/activityRoutes";
import createHttpError, { isHttpError } from "http-errors";
import { httpLogger } from "./middleware/httpLogger";
import logger from "./util/logger";
import cors from "cors";
import session from "express-session";
import env from "./util/validateEnv";
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { requireAuth } from "./middleware/auth";
import { requireSuperAdmin } from "./admin/middleware/requireSuperAdmin";
import { helmetMiddleware, adminRateLimiter, requireHttps } from "./middleware/security";
import prisma from "./util/db";

const app = express();

// Security middlewares
app.use(requireHttps); // Force HTTPS en production
app.use(helmetMiddleware); // Headers de securite (CSP, X-Frame-Options, etc.)

// Trust proxy for production (behind Traefik)
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS needed for dev environment (in prod, nginx proxy handles same-origin)
if (env.CORS_ORIGIN) {
  app.use(cors({ credentials: true, origin: env.CORS_ORIGIN }));
}

app.use(httpLogger);

app.use(express.json());

// User session middleware (cookie: connect.sid, duree: 1h)
export const userSession = session({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
app.use("/api/auth", userSession, authRoutes);
app.use("/api/recipes", userSession, requireAuth, recipesRoutes);
app.use("/api/tags", userSession, requireAuth, tagsRoutes);
app.use("/api/ingredients", userSession, requireAuth, ingredientsRoutes);
app.use("/api/communities", userSession, requireAuth, communitiesRoutes);
app.use("/api/invites", userSession, requireAuth, invitesRoutes);
app.use("/api/users", userSession, requireAuth, usersRoutes);
app.use("/api/proposals", userSession, requireAuth, proposalsRoutes);
app.use("/api/tag-suggestions", userSession, requireAuth, tagSuggestionsRoutes);

// Admin routes (avec admin session isolee + rate limiting global)
app.use("/api/admin", adminRateLimiter); // Rate limit global admin (30 req/min)
app.use("/api/admin/auth", adminSession, adminAuthRoutes);
app.use("/api/admin/tags", adminSession, requireSuperAdmin, adminTagsRoutes);
app.use("/api/admin/ingredients", adminSession, requireSuperAdmin, adminIngredientsRoutes);
app.use("/api/admin/communities", adminSession, requireSuperAdmin, adminCommunitiesRoutes);
app.use("/api/admin/features", adminSession, requireSuperAdmin, adminFeaturesRoutes);
app.use("/api/admin/dashboard", adminSession, requireSuperAdmin, adminDashboardRoutes);
app.use("/api/admin/activity", adminSession, requireSuperAdmin, adminActivityRoutes);

app.use((req, res, next) => {
  next(createHttpError(404, "Endpoint not found"));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled error");
  let errorMessage = "An unknown error occurred";
  let statusCode = 500;
  if (isHttpError(error)) {
    statusCode = error.status;
    errorMessage = error.message;
  }
  res.status(statusCode).json({ error: errorMessage });
});

export default app;