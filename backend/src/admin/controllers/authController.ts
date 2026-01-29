import { RequestHandler } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import prisma from "../../util/db";

const MAX_TOTP_ATTEMPTS = 3;
const APP_NAME = "ForestManager";

/**
 * POST /api/admin/auth/login
 * Premiere etape: verification email/password
 * Si totpEnabled = false, retourne le QR code pour configurer TOTP
 */
export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createHttpError(400, "ADMIN_003: Email and password required");
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      // Message generique pour eviter l'enumeration
      throw createHttpError(401, "ADMIN_004: Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw createHttpError(401, "ADMIN_004: Invalid credentials");
    }

    // Stocke l'adminId en session (mais totpVerified reste false)
    req.session.adminId = admin.id;
    req.session.totpVerified = false;
    req.session.totpAttempts = 0;

    // Si TOTP pas encore configure, generer le QR code
    if (!admin.totpEnabled) {
      const otpauth = authenticator.keyuri(admin.email, APP_NAME, admin.totpSecret);
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

      return res.status(200).json({
        requiresTotpSetup: true,
        qrCode: qrCodeDataUrl,
        message: "Scan this QR code with your authenticator app, then verify with a code",
      });
    }

    res.status(200).json({
      requiresTotpSetup: false,
      message: "Please enter your TOTP code",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/auth/totp/verify
 * Deuxieme etape: verification du code TOTP
 * Finalise l'authentification si le code est valide
 */
export const verifyTotp: RequestHandler = async (req, res, next) => {
  try {
    const { code } = req.body;
    const adminId = req.session.adminId;

    if (!adminId) {
      throw createHttpError(401, "ADMIN_001: Not authenticated");
    }

    if (!code) {
      throw createHttpError(400, "ADMIN_005: TOTP code required");
    }

    // Verifier le nombre de tentatives
    const attempts = req.session.totpAttempts || 0;
    if (attempts >= MAX_TOTP_ATTEMPTS) {
      // Reset la session et bloquer
      req.session.destroy(() => {});
      throw createHttpError(429, "ADMIN_006: Too many failed attempts, please login again");
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw createHttpError(401, "ADMIN_001: Not authenticated");
    }

    const isValid = authenticator.verify({
      token: code,
      secret: admin.totpSecret,
    });

    if (!isValid) {
      req.session.totpAttempts = attempts + 1;
      throw createHttpError(401, "ADMIN_007: Invalid TOTP code");
    }

    // TOTP valide - marquer comme configure si premiere fois
    if (!admin.totpEnabled) {
      await prisma.adminUser.update({
        where: { id: adminId },
        data: { totpEnabled: true },
      });

      // Log du setup TOTP
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          type: "ADMIN_TOTP_SETUP",
          metadata: { ip: req.ip },
        },
      });
    }

    // Finaliser l'authentification
    req.session.totpVerified = true;
    req.session.totpAttempts = 0;

    // Mettre a jour lastLoginAt et logger
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { lastLoginAt: new Date() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId: admin.id,
        type: "ADMIN_LOGIN",
        metadata: { ip: req.ip },
      },
    });

    res.status(200).json({
      message: "Authentication successful",
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/auth/logout
 * Detruit la session admin
 */
export const logout: RequestHandler = async (req, res, next) => {
  try {
    const adminId = req.session.adminId;

    if (adminId) {
      await prisma.adminActivityLog.create({
        data: {
          adminId,
          type: "ADMIN_LOGOUT",
          metadata: { ip: req.ip },
        },
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return next(createHttpError(500, "ADMIN_008: Logout failed"));
      }
      res.clearCookie("admin.sid");
      res.status(200).json({ message: "Logged out successfully" });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/auth/me
 * Retourne les infos de l'admin connecte
 */
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const adminId = req.session.adminId;

    if (!adminId) {
      throw createHttpError(401, "ADMIN_001: Not authenticated");
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw createHttpError(404, "ADMIN_009: Admin not found");
    }

    res.status(200).json({ admin });
  } catch (error) {
    next(error);
  }
};
