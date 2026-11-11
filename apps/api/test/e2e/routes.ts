// Routes reservees aux E2E [D79, D197] : `POST /api/v1/__test/scenario` cree les
// donnees d'un parcours par les fabriques des tests d'integration, et
// `POST /api/v1/__test/reset` vide la base hors referentiels.
//
// Ce fichier vit sous `test/` : il n'est pas copie dans l'image de production.
// `server.ts` ne le charge qu'en NODE_ENV=test, et `createApp` ne monte ces
// routes que dans cet environnement.
import { readdir, readFile } from "node:fs/promises";

import { spaceRoleSchema } from "@fm/shared";
import { TEST_PASSWORD } from "@fm/test-utils";
import { Router } from "express";
import { z } from "zod";

import type { Context } from "../../src/core/context.ts";
import { AppError } from "../../src/core/http/errors.ts";
import { handle } from "../../src/core/http/validate.ts";
import { createAdmin } from "../helpers/admin.ts";
import { resetDatabase } from "../helpers/db.ts";
import {
  addMember,
  createSpace,
  grantModule,
  createUser,
  setTestPasswordHash,
  testPasswordHash,
} from "../helpers/factories.ts";

const scenarioBodySchema = z.discriminatedUnion("name", [
  /** Un compte avec son espace perso. */
  z.object({ name: z.literal("user"), username: z.string().optional() }),
  /** Un espace groupe, son OWNER et un membre par role demande. */
  z.object({
    name: z.literal("group"),
    spaceName: z.string().optional(),
    ownerName: z.string().optional(),
    members: z.array(spaceRoleSchema.exclude(["OWNER"])).default(["MEMBER"]),
    /** Modules actives en plus de ceux par defaut ("meal-plan"...). */
    modules: z.array(z.string()).default([]),
  }),
  /** Un super admin, 2FA deja configuree : le parcours calcule le code avec `totpSecret`. */
  z.object({ name: z.literal("admin") }),
]);

type Scenario = z.output<typeof scenarioBodySchema>;

/** Ce dont un parcours a besoin pour se connecter avec ce compte. */
async function account(username?: string) {
  const user = await createUser(username ? { username } : {});
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    personalSpaceId: user.personalSpaceId,
  };
}

async function build(scenario: Scenario) {
  switch (scenario.name) {
    case "user":
      return { user: await account(scenario.username) };
    case "group": {
      const owner = await account(scenario.ownerName);
      const space = await createSpace(
        owner.id,
        scenario.spaceName ? { name: scenario.spaceName } : {}
      );
      for (const code of scenario.modules) await grantModule(space.id, code);
      const members = [];
      for (const role of scenario.members) {
        const member = await account();
        await addMember(space.id, member.id, role);
        members.push({ ...member, role });
      }
      return { owner, space: { id: space.id, name: space.name }, members };
    }
    case "admin": {
      const admin = await createAdmin();
      return {
        admin: {
          id: admin.id,
          username: admin.username,
          password: admin.password,
          totpSecret: admin.totpSecret,
        },
      };
    }
  }
}

/**
 * Pages de reference des imports (15-Plan-Tests S5), lues par l'API elle-meme
 * sur la boucle locale (`allowLoopback` en NODE_ENV=test, voir `server.ts`).
 * Seuls les noms presents dans le dossier sont servis : aucun chemin n'est
 * construit a partir de l'URL.
 */
const FIXTURES = new URL("../fixtures/import/", import.meta.url);

async function importFixture(name: string): Promise<string | null> {
  const names = await readdir(FIXTURES);
  return names.includes(name) ? readFile(new URL(name, FIXTURES), "utf8") : null;
}

export function e2eRoutes(ctx: Context): Router {
  const router = Router();

  // Le hash du mot de passe de test est calcule une fois (setup.ts le fait deja sous Vitest).
  async function ready(): Promise<void> {
    if (!testPasswordHash()) setTestPasswordHash(await ctx.hasher.hash(TEST_PASSWORD));
  }

  router.post(
    "/scenario",
    handle({ body: scenarioBodySchema }, async ({ body }, _req, res) => {
      await ready();
      res.status(201).json(await build(body));
    })
  );

  router.post(
    "/reset",
    handle({}, async (_input, _req, res) => {
      await resetDatabase();
      res.status(204).end();
    })
  );

  router.get(
    "/fixtures/import/:name",
    handle({ params: z.object({ name: z.string() }) }, async ({ params }, _req, res) => {
      const html = await importFixture(params.name);
      if (html === null) throw new AppError("COMMON_003");
      res.type("html").send(html);
    })
  );

  return router;
}
