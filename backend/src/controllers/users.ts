import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import bcrypt from "bcrypt";

export const getAuthenticatedUser: RequestHandler = async (req, res, next) => {

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.session.userId,
      },
      select: {
        username: true,
        email: true,
      },
    })
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }

};

interface SignUpBody {
  username?: string,
  email?: string
  password?: string
}


export const signUp: RequestHandler<unknown, unknown, SignUpBody, unknown> = async (req, res, next) => {
  const username = req.body.username;
  const email = req.body.email;
  const passwordRaw = req.body.password;

  try {
    if (!username || !email || !passwordRaw) {
      throw createHttpError(400, "Parameters missing.");
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        username: true,
      },
    })

    if (existingUsername) {
      throw createHttpError(409, "Username already taken. Please choose a different one or log in instead.");
    }

    const existingEmail = await prisma.user.findUnique({
      where: {
        email: email,
      },
      select: {
        email: true,
      },
    })

    if (existingEmail) {
      throw createHttpError(409, "A user with this email adress already exist. Please log in instead.");
    }

    const passwordHashed = await bcrypt.hash(passwordRaw, 10);


    const newUser = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: passwordHashed,
      },
    });

    req.session.userId = newUser.id;


    res.status(201).json(newUser);


  } catch (error) {
    next(error);
  }

};

interface LoginBody {
  username?: string,
  password?: string,
}

export const login: RequestHandler<unknown, unknown, LoginBody, unknown> = async (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    if (!username || !password) {
      throw createHttpError(400, "Parameters missing");
    }

    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
      },
    })

    if (!user) {
      throw createHttpError(401, "Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {

      throw createHttpError(401, "Invalid credentials");
    }

    req.session.userId = user.id;
    res.status(201).json(user);


  } catch (error) {

    next(error);
  }

};

export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy(error => {
    if (error) {
      next(error);
    } else {
      res.sendStatus(200);
    }
  });
}