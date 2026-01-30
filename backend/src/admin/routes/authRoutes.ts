import express, { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController";
import { requireAdminSession, requireSuperAdmin } from "../middleware/requireSuperAdmin";
import env from "../../util/validateEnv";

const router = express.Router();

// Rate limiter pour les routes d'auth admin (5 tentatives / 15min)
// Desactive en mode test pour permettre l'execution des tests
const adminAuthLimiter: RequestHandler = env.NODE_ENV === "test"
  ? ((_req, _res, next) => next())
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 tentatives max
      message: { error: "ADMIN_010: Too many login attempts, please try again later" },
      standardHeaders: true,
      legacyHeaders: false,
    });

// POST /api/admin/auth/login - Premiere etape (email/password)
router.post("/login", adminAuthLimiter, authController.login);

// POST /api/admin/auth/totp/verify - Deuxieme etape (TOTP)
// Necessite une session admin initiee (apres login)
router.post("/totp/verify", adminAuthLimiter, requireAdminSession, authController.verifyTotp);

// POST /api/admin/auth/logout - Deconnexion
router.post("/logout", authController.logout);

// GET /api/admin/auth/me - Infos admin connecte
// Necessite authentification complete (login + TOTP)
router.get("/me", requireSuperAdmin, authController.getMe);

export default router;
