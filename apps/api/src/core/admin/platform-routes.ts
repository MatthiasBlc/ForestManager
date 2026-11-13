// Routes admin du journal, des reglages et du tableau de bord (C4.6), derriere requireAdmin.
import {
  adminDashboardSchema,
  auditEntrySchema,
  auditQuerySchema,
  offsetPageSchema,
  platformSettingsSchema,
  serviceTestParamsSchema,
  serviceTestResultSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { handle, reply } from "../http/validate.ts";
import * as platform from "./platform.ts";
import { currentAdminId } from "./session.ts";

export function adminPlatformRouter(ctx: Context): Router {
  const router = Router();

  router.get(
    "/audit",
    handle({ query: auditQuerySchema }, async ({ query }, _req, res) => {
      reply(res, offsetPageSchema(auditEntrySchema), await platform.listAudit(ctx, query));
    })
  );

  router.get("/settings", (_req, res) => {
    reply(res, platformSettingsSchema, platform.settings(ctx));
  });

  router.post(
    "/settings/test/:service",
    handle({ params: serviceTestParamsSchema }, async ({ params }, req, res) => {
      const result = await platform.testService(ctx, currentAdminId(req), params.service);
      reply(res, serviceTestResultSchema, result);
    })
  );

  router.get("/dashboard", async (_req, res) => {
    reply(res, adminDashboardSchema, await platform.dashboard(ctx));
  });

  return router;
}
