import { RequestHandler } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import prisma from "../util/db";
import { AUTH_001, AUTH_006, AUTH_007, AUTH_011, USER_001 } from "../constants/errorCodes";
import { UpdateProfileInput } from "../schemas/user.schema";

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

export const updateProfile: RequestHandler<unknown, unknown, UpdateProfileInput> = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.session.userId;
    if (!userId) throw createHttpError(401, AUTH_001);

    const { username, email, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw createHttpError(404, USER_001);

    const updates: { username?: string; email?: string; password?: string } = {};

    if (username && username !== user.username) {
      const existing = await prisma.user.findFirst({
        where: { username, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, AUTH_006);
      updates.username = username;
    }

    if (email && email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { email, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw createHttpError(409, AUTH_007);
      updates.email = email;
    }

    if (newPassword && currentPassword) {
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        throw createHttpError(401, AUTH_011);
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
