import express, { NextFunction, Request, Response } from "express";
import recipesRoutes from "./routes/recipes";
import userRoutes from "./routes/users";
import communitiesRoutes from "./routes/communities";
import morgan from "morgan";
import createHttpError, { isHttpError } from "http-errors";
import cors from "cors";
import session from "express-session";
import env from "./util/validateEnv";
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "./middleware/auth";
// is it ok to have a new prisma client here ?


const app = express();

// cors needed for dev environment
app.use(cors({ credentials: true, origin: env.CORS_ORIGIN }));

app.use(morgan("dev"));

app.use(express.json());

app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000,
  },
  rolling: true,
  store: new PrismaSessionStore(
    new PrismaClient(),
    {
      checkPeriod: 2 * 60 * 1000,  //ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }
  )
}));

// Health check endpoint (before auth, no logging)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/users", userRoutes);
app.use("/api/recipes", requireAuth, recipesRoutes);
app.use("/api/communities", requireAuth, communitiesRoutes);

app.use((req, res, next) => {
  next(createHttpError(404, "Endpoint not found"));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(error);
  let errorMessage = "An unknown error occurred";
  let statusCode = 500;
  if (isHttpError(error)) {
    statusCode = error.status;
    errorMessage = error.message;
  }
  res.status(statusCode).json({ error: errorMessage });
});

export default app;