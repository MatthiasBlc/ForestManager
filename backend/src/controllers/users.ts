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
  validateStringLength,
} from "../util/validation";

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
    if (!userId) throw createHttpError(401, "AUTH_001: Not authenticated");

    const { username, email, currentPassword, newPassword } = req.body;

    // Type guards
    assertOptionalString(username, "username");
    assertOptionalString(email, "email");
    assertOptionalString(currentPassword, "currentPassword");
    assertOptionalString(newPassword, "newPassword");

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw createHttpError(404, "USER_001: User not found");

    const updates: { username?: string; email?: string; password?: string } = {};

    if (username && username !== user.username) {
      if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        throw createHttpError(
          400,
          `AUTH_004: Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`
        );
      }
      if (!USERNAME_REGEX.test(username)) {
        throw createHttpError(
          400,
          "AUTH_004: Username can only contain letters, numbers, and underscores"
        );
      }
      const existing = await prisma.user.findFirst({
        where: { username, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, "AUTH_006: Username already taken");
      updates.username = username;
    }

    if (email && email !== user.email) {
      if (!EMAIL_REGEX.test(email)) {
        throw createHttpError(400, "AUTH_003: Invalid email format");
      }
      const existing = await prisma.user.findFirst({
        where: { email, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, "AUTH_007: Email already in use");
      updates.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        throw createHttpError(400, "AUTH_010: Current password is required to change password");
      }
      assertString(currentPassword, "currentPassword");
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        throw createHttpError(401, "AUTH_011: Current password is incorrect");
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
        throw createHttpError(
          400,
          `AUTH_005: Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`
        );
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
