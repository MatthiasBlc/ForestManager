import express from "express";
import createHttpError from "http-errors";
import cors from "cors";
import env from "./util/validateEnv";
import { httpLogger } from "./middleware/httpLogger";
import { helmetMiddleware, adminRateLimiter, requireHttps } from "./middleware/security";
import { csrfProtection } from "./middleware/csrf";
import { requireAuth } from "./middleware/auth";
import { requireSuperAdmin } from "./admin/middleware/requireSuperAdmin";
import { userSession, adminSession } from "./config/session";
import { errorHandler } from "./middleware/errorHandler";

// User routes
import authRoutes from "./routes/auth";
import recipesRoutes from "./routes/recipes";
import tagsRoutes from "./routes/tags";
import ingredientsRoutes from "./routes/ingredients";
import unitsRoutes from "./routes/units";
import communitiesRoutes from "./routes/communities";
import invitesRoutes from "./routes/invites";
import usersRoutes from "./routes/users";
import proposalsRoutes from "./routes/proposals";
import tagSuggestionsRoutes from "./routes/tagSuggestions";
import notificationsRoutes from "./routes/notifications";

// Admin routes
import adminAuthRoutes from "./admin/routes/authRoutes";
import adminTagsRoutes from "./admin/routes/tagsRoutes";
import adminIngredientsRoutes from "./admin/routes/ingredientsRoutes";
import adminCommunitiesRoutes from "./admin/routes/communitiesRoutes";
import adminFeaturesRoutes from "./admin/routes/featuresRoutes";
import adminDashboardRoutes from "./admin/routes/dashboardRoutes";
import adminActivityRoutes from "./admin/routes/activityRoutes";
import adminUnitsRoutes from "./admin/routes/unitsRoutes";
import adminRecipesRoutes from "./admin/routes/recipesRoutes";

const app = express();

// Global middleware
app.use(requireHttps);
app.use(helmetMiddleware);
if (env.NODE_ENV === "production") app.set("trust proxy", 1);
if (env.CORS_ORIGIN) app.use(cors({ credentials: true, origin: env.CORS_ORIGIN }));
app.use(httpLogger);
app.use(express.json({ limit: "50kb" }));
app.use(csrfProtection);

// Health check
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// User routes
app.use("/api/auth", userSession, authRoutes);
app.use("/api/recipes", userSession, requireAuth, recipesRoutes);
app.use("/api/tags", userSession, requireAuth, tagsRoutes);
app.use("/api/ingredients", userSession, requireAuth, ingredientsRoutes);
app.use("/api/units", userSession, requireAuth, unitsRoutes);
app.use("/api/communities", userSession, requireAuth, communitiesRoutes);
app.use("/api/invites", userSession, requireAuth, invitesRoutes);
app.use("/api/users", userSession, requireAuth, usersRoutes);
app.use("/api/proposals", userSession, requireAuth, proposalsRoutes);
app.use("/api/tag-suggestions", userSession, requireAuth, tagSuggestionsRoutes);
app.use("/api/notifications", userSession, requireAuth, notificationsRoutes);

// Admin routes
app.use("/api/admin", adminRateLimiter);
app.use("/api/admin/auth", adminSession, adminAuthRoutes);
app.use("/api/admin/tags", adminSession, requireSuperAdmin, adminTagsRoutes);
app.use("/api/admin/ingredients", adminSession, requireSuperAdmin, adminIngredientsRoutes);
app.use("/api/admin/communities", adminSession, requireSuperAdmin, adminCommunitiesRoutes);
app.use("/api/admin/features", adminSession, requireSuperAdmin, adminFeaturesRoutes);
app.use("/api/admin/dashboard", adminSession, requireSuperAdmin, adminDashboardRoutes);
app.use("/api/admin/activity", adminSession, requireSuperAdmin, adminActivityRoutes);
app.use("/api/admin/units", adminSession, requireSuperAdmin, adminUnitsRoutes);
app.use("/api/admin/recipes", adminSession, requireSuperAdmin, adminRecipesRoutes);

// 404 + error handler
app.use((_req, _res, next) => next(createHttpError(404, "Endpoint not found")));
app.use(errorHandler);

export { userSession };
export default app;
