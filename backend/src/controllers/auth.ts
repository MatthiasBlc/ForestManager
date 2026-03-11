import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import bcrypt from "bcrypt";
import {
  EMAIL_REGEX,
  USERNAME_REGEX,
  MIN_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  assertString,
} from "../util/validation";
import {
  AUTH_001,
  AUTH_002,
  AUTH_003,
  AUTH_004_LENGTH,
  AUTH_004_FORMAT,
  AUTH_005,
  AUTH_006,
  AUTH_007,
  AUTH_008,
  AUTH_009,
} from "../constants/errorCodes";

/**
 * GET /api/auth/me
 * Retourne les infos de l'utilisateur connecte
 */
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      throw createHttpError(401, AUTH_001);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.session.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      // User was deleted or not found
      req.session.destroy(() => {});
      throw createHttpError(401, AUTH_009);
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

interface SignUpBody {
  username?: string;
  email?: string;
  password?: string;
}

/**
 * POST /api/auth/signup
 * Cree un nouvel utilisateur
 */
export const signUp: RequestHandler<unknown, unknown, SignUpBody, unknown> = async (
  req,
  res,
  next
) => {
  const { username, email, password } = req.body;

  try {
    // Validation des parametres requis
    if (!username || !email || !password) {
      throw createHttpError(400, AUTH_002);
    }

    // Type guards (rejette number, object, array)
    assertString(username, "username");
    assertString(email, "email");
    assertString(password, "password");

    // Validation email
    if (!EMAIL_REGEX.test(email)) {
      throw createHttpError(400, AUTH_003);
    }

    // Validation username format et longueur
    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      throw createHttpError(400, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH));
    }
    if (!USERNAME_REGEX.test(username)) {
      throw createHttpError(400, AUTH_004_FORMAT);
    }

    // Validation password longueur
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      throw createHttpError(400, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH));
    }

    // Verification username unique (excluant les comptes supprimes)
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: username,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingUsername) {
      throw createHttpError(409, AUTH_006);
    }

    // Verification email unique (excluant les comptes supprimes)
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      throw createHttpError(409, AUTH_007);
    }

    const passwordHashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: passwordHashed,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    // Regenerer la session pour prevenir la session fixation
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = newUser.id;
      res.status(201).json({ user: newUser });
    });
  } catch (error) {
    next(error);
  }
};

interface LoginBody {
  username?: string;
  password?: string;
}

/**
 * POST /api/auth/login
 * Authentifie un utilisateur existant
 */
export const login: RequestHandler<unknown, unknown, LoginBody, unknown> = async (
  req,
  res,
  next
) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      throw createHttpError(400, AUTH_002);
    }

    // Type guards
    assertString(username, "username");
    assertString(password, "password");

    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw createHttpError(401, AUTH_008);
    }

    // Verifier si le compte est desactive (soft deleted)
    if (user.deletedAt !== null) {
      throw createHttpError(401, AUTH_009);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw createHttpError(401, AUTH_008);
    }

    // Regenerer la session pour prevenir la session fixation
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;

      res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Detruit la session utilisateur
 */
export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
    } else {
      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out successfully" });
    }
  });
};
