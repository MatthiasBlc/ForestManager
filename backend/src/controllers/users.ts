import { RequestHandler } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import prisma from "../util/db";
import {
  EMAIL_REGEX,
  USERNAME_REGEX,
  MIN_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  assertOptionalString,
  assertString,
} from "../util/validation";
import {
  AUTH_001,
  AUTH_003,
  AUTH_004_LENGTH,
  AUTH_004_FORMAT,
  AUTH_005,
  AUTH_006,
  AUTH_007,
  AUTH_010,
  AUTH_011,
  USER_001,
} from "../constants/errorCodes";

export const searchUsers: RequestHandler = async (req, res, next) => {
  try {
    const query = ((req.query.q as string) || "").trim();

    if (query.length < 3) {
      res.status(200).json({ data: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        username: { startsWith: query, mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true, username: true },
      take: 5,
      orderBy: { username: "asc" },
    });

    res.status(200).json({ data: users });
  } catch (error) {
    next(error);
  }
};

interface UpdateProfileBody {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export const updateProfile: RequestHandler<unknown, unknown, UpdateProfileBody> = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.session.userId;
    if (!userId) throw createHttpError(401, AUTH_001);

    const { username, email, currentPassword, newPassword } = req.body;

    // Type guards
    assertOptionalString(username, "username");
    assertOptionalString(email, "email");
    assertOptionalString(currentPassword, "currentPassword");
    assertOptionalString(newPassword, "newPassword");

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw createHttpError(404, USER_001);

    const updates: { username?: string; email?: string; password?: string } = {};

    if (username && username !== user.username) {
      if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        throw createHttpError(400, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH));
      }
      if (!USERNAME_REGEX.test(username)) {
        throw createHttpError(400, AUTH_004_FORMAT);
      }
      const existing = await prisma.user.findFirst({
        where: { username, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, AUTH_006);
      updates.username = username;
    }

    if (email && email !== user.email) {
      if (!EMAIL_REGEX.test(email)) {
        throw createHttpError(400, AUTH_003);
      }
      const existing = await prisma.user.findFirst({
        where: { email, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, AUTH_007);
      updates.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        throw createHttpError(400, AUTH_010);
      }
      assertString(currentPassword, "currentPassword");
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        throw createHttpError(401, AUTH_011);
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
        throw createHttpError(400, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH));
      }
      updates.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      res.status(200).json({
        message: "No changes",
        user: { id: user.id, username: user.username, email: user.email },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, username: true, email: true, createdAt: true },
    });

    res.status(200).json({ user: updated });
  } catch (error) {
    next(error);
  }
};
