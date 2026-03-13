import express from "express";
import * as authController from "../controllers/authController";
import { requireAdminSession, requireSuperAdmin } from "../middleware/requireSuperAdmin";
import { ADMIN_010 } from "../../constants/errorCodes";
import { createRateLimiter } from "../../config/rateLimiter";
import { validateBody } from "../../middleware/validateBody";
import { adminLoginSchema, verifyTotpSchema } from "../schemas/auth.schema";

const router = express.Router();

/** Rate limiter admin auth : 5 req / 15 min */
const adminAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: ADMIN_010,
});

// POST /api/admin/auth/login - Premiere etape (email/password)
router.post("/login", adminAuthLimiter, validateBody(adminLoginSchema), authController.login);

// POST /api/admin/auth/totp/verify - Deuxieme etape (TOTP)
// Necessite une session admin initiee (apres login)
router.post(
  "/totp/verify",
  adminAuthLimiter,
  requireAdminSession,
  validateBody(verifyTotpSchema),
  authController.verifyTotp
);

// POST /api/admin/auth/logout - Deconnexion
router.post("/logout", authController.logout);

// GET /api/admin/auth/me - Infos admin connecte
// Necessite authentification complete (login + TOTP)
router.get("/me", requireSuperAdmin, authController.getMe);

export default router;
