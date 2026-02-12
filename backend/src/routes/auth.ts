import express from "express";
import * as authController from "../controllers/auth";
import { authRateLimiter } from "../middleware/security";

const router = express.Router();

// POST /api/auth/signup - Creer un nouvel utilisateur
router.post("/signup", authRateLimiter, authController.signUp);

// POST /api/auth/login - Authentifier un utilisateur
router.post("/login", authRateLimiter, authController.login);

// POST /api/auth/logout - Deconnecter l'utilisateur
router.post("/logout", authController.logout);

// GET /api/auth/me - Obtenir les infos de l'utilisateur connecte
router.get("/me", authController.getMe);

export default router;
