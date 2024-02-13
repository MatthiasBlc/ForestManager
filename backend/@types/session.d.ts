import prisma from "../src/util/db";

declare module "express-session" {
  interface SessionData {
    userId: prisma.Types.ObjectId;
  }
}