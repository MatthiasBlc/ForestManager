// Export de donnees (C6b.2) [P12, D37, D192].
import {
  dataExportSchema,
  RECIPES_EXPORT_FORMAT,
  recipesExportSchema,
  type DataExport,
} from "@fm/shared";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { expireExports } from "../src/core/exports/service.ts";
import { sweepStorage } from "../src/core/storage/images.ts";
import { createContext } from "../src/core/http/app.ts";
import { MODULES } from "../src/modules/index.ts";
import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db, testEnv, testStorage } from "./helpers/db.ts";
import { webpBytes } from "./helpers/images.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, ingredient, unitId } from "./helpers/recipes.ts";
import { pino } from "pino";

const app = createTestApp();

/** Relit le statut jusqu'a la fin de la generation. */
async function settled(client: Client, id: string): Promise<DataExport> {
  for (let i = 0; i < 100; i++) {
    const res = await client.get(`/me/exports/${id}`);
    const body = dataExportSchema.parse(res.body);
    if (body.status !== "PENDING") return body;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("export still pending");
}

async function download(client: Client, id: string) {
  const res = await client.agent
    .get(`/api/v1/me/exports/${id}/download`)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        callback(null, Buffer.concat(chunks));
      });
    });
  return res;
}

async function exportFiles(client: Client, body: Record<string, unknown>) {
  const created = await client.post("/me/exports", body);
  expect(created.status).toBe(202);
  const done = await settled(client, created.body.id as string);
  expect(done.status).toBe("READY");
  const res = await download(client, done.id);
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toBe("application/zip");
  expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="forest-manager-/);
  return unzipSync(new Uint8Array(res.body as Buffer));
}

describe("POST /me/exports", () => {
  it("exige une session et refuse un corps incoherent", async () => {
    const anonymous = await createClient(app);
    expect((await anonymous.post("/me/exports", { scope: "MY_RECIPES" })).status).toBe(401);
    const client = await loginAs(await createUser(), app);
    const missing = await client.post("/me/exports", { scope: "SPACE", format: "JSON" });
    expect(missing.body.error.code).toBe("VALIDATION_001");
  });

  it("sans stockage configure : export indisponible", async () => {
    const client = await loginAs(await createUser(), createTestApp({ storage: null }));
    const res = await client.post("/me/exports", { scope: "MY_RECIPES", format: "JSON" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("EXPORT_002");
  });

  it("exporte ses recettes de tous ses espaces en JSON relu par le schema", async () => {
    const lea = await createUser({ username: "lea_x1" });
    const sam = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    await addMember(famille.id, sam.id);
    const client = await loginAs(lea, app);
    const samClient = await loginAs(sam, app);
    const sauce = await createRecipe(client, famille.id, { title: "Sauce tomate", isBase: true });
    await createRecipe(client, lea.personalSpaceId, { title: "Crêpes" });
    await createRecipe(client, famille.id, {
      title: "Lasagnes",
      description: "Au four",
      blocks: [
        { kind: "RECIPE", recipeId: sauce.id, quantity: 300, unitId: await unitId("ml") },
        {
          kind: "LOCAL",
          title: "Montage",
          ingredients: [
            {
              ingredientId: await ingredient(client, "Pâtes à lasagne"),
              quantity: 12,
              unitId: await unitId("piece"),
              note: "precuites",
            },
          ],
          steps: ["Alterner les couches.", "Cuire 40 min."],
        },
      ],
    });
    await createRecipe(samClient, famille.id, { title: "Recette de Sam" });

    const files = await exportFiles(client, { scope: "MY_RECIPES", format: "JSON" });
    expect(Object.keys(files)).toEqual(["recettes.json"]);
    const archive = recipesExportSchema.parse(JSON.parse(strFromU8(files["recettes.json"]!)));
    expect(archive.format).toBe(RECIPES_EXPORT_FORMAT);
    expect(archive.recipes.map((r) => r.title).sort()).toEqual([
      "Crêpes",
      "Lasagnes",
      "Sauce tomate",
    ]);

    const lasagnes = archive.recipes.find((r) => r.title === "Lasagnes")!;
    const sauceRef = archive.recipes.find((r) => r.title === "Sauce tomate")!.ref;
    expect(lasagnes).toMatchObject({ author: "lea_x1", space: "Famille", description: "Au four" });
    expect(lasagnes.blocks).toEqual([
      {
        kind: "RECIPE",
        title: null,
        recipe: sauceRef,
        recipeTitle: "Sauce tomate",
        quantity: 300,
        unit: "ml",
      },
      {
        kind: "LOCAL",
        title: "Montage",
        ingredients: [
          {
            name: "Pâtes à lasagne",
            quantity: 12,
            unit: "piece",
            note: "precuites",
            optional: false,
          },
        ],
        steps: ["Alterner les couches.", "Cuire 40 min."],
      },
    ]);
  });

  it("exporte un espace en Markdown, un fichier par recette, photos comprises", async () => {
    const lea = await createUser();
    const sam = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    await addMember(famille.id, sam.id);
    const client = await loginAs(lea, app);
    const samClient = await loginAs(sam, app);
    const gratin = await createRecipe(client, famille.id, { title: "Gratin de pâtes" });
    await createRecipe(samClient, famille.id, { title: "Gratin de pâtes" });
    await testStorage.put(`recipes/${gratin.id}/photo.webp`, webpBytes(64, 64), "image/webp");
    await db.recipe.update({
      where: { id: gratin.id },
      data: { imageKey: `recipes/${gratin.id}/photo.webp` },
    });

    const files = await exportFiles(client, {
      scope: "SPACE",
      spaceId: famille.id,
      format: "MARKDOWN",
      photos: true,
    });
    const names = Object.keys(files).sort();
    expect(names).toEqual([
      "gratin-de-pates-2.md",
      "gratin-de-pates.md",
      "photos/gratin-de-pates.webp",
    ]);
    const markdown = strFromU8(files["gratin-de-pates.md"]!);
    expect(markdown).toContain("# Gratin de pâtes");
    expect(markdown).toContain("![Gratin de pâtes](photos/gratin-de-pates.webp)");
    expect(markdown).toContain("- 500 g Pâtes");
    expect(markdown).toContain("1. Cuire les pates.");

    const activity = await db.activityEvent.findFirst({
      where: { spaceId: famille.id, type: "core.space.exported" },
    });
    expect(activity?.actorId).toBe(lea.id);
  });

  it("reserve l'export d'un espace a l'OWNER, un par espace sur 24 h", async () => {
    const lea = await createUser();
    const sam = await createUser();
    const famille = await createSpace(lea.id);
    await addMember(famille.id, sam.id, "MODERATOR");
    const samClient = await loginAs(sam, app);
    const body = { scope: "SPACE", spaceId: famille.id, format: "JSON" };
    expect((await samClient.post("/me/exports", body)).body.error.code).toBe("SPACE_002");

    const client = await loginAs(lea, app);
    const first = await client.post("/me/exports", body);
    expect(first.status).toBe(202);
    await settled(client, first.body.id as string);
    const second = await client.post("/me/exports", body);
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe("EXPORT_001");
    const nextAt = Date.parse(second.body.error.details.nextAt as string);
    expect(nextAt - Date.parse(first.body.createdAt as string)).toBe(24 * 60 * 60 * 1000);

    // Ses recettes restent exportables a volonte.
    expect((await client.post("/me/exports", { scope: "MY_RECIPES", format: "JSON" })).status).toBe(
      202
    );
  });

  it("l'espace perso ne s'exporte pas comme un espace", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    const res = await client.post("/me/exports", {
      scope: "SPACE",
      spaceId: lea.personalSpaceId,
      format: "JSON",
    });
    expect(res.body.error.code).toBe("SPACE_003");
  });
});

describe("GET /me/exports/:id", () => {
  it("n'est lisible et telechargeable que par son demandeur", async () => {
    const lea = await createUser();
    const sam = await createUser();
    const client = await loginAs(lea, app);
    const created = await client.post("/me/exports", { scope: "MY_RECIPES", format: "JSON" });
    await settled(client, created.body.id as string);

    const samClient = await loginAs(sam, app);
    expect((await samClient.get(`/me/exports/${created.body.id as string}`)).body.error.code).toBe(
      "EXPORT_003"
    );
    expect((await download(samClient, created.body.id as string)).status).toBe(404);
    expect(
      (await client.get("/me/exports/00000000-0000-4000-8000-000000000000")).body.error.code
    ).toBe("EXPORT_003");
  });

  it("expire apres 24 h : statut EXPIRED, fichier efface par le menage", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    const created = await client.post("/me/exports", { scope: "MY_RECIPES", format: "JSON" });
    const done = await settled(client, created.body.id as string);
    expect(done.expiresAt).not.toBeNull();
    const row = await db.dataExport.findUniqueOrThrow({ where: { id: done.id } });
    const key = row.fileKey!;

    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: MODULES,
      storage: testStorage,
    });
    // Toujours reference avant l'expiration : le menage le garde.
    await sweepStorage(ctx, new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(await testStorage.read(key, 10_000_000)).not.toBeNull();

    const later = new Date(Date.parse(done.expiresAt!) + 1000);
    expect(await expireExports(ctx, later)).toBeGreaterThanOrEqual(1);
    expect((await settled(client, done.id)).status).toBe("EXPIRED");
    expect((await download(client, done.id)).status).toBe(404);
    await sweepStorage(ctx, new Date(later.getTime() + 2 * 60 * 60 * 1000));
    expect(await testStorage.read(key, 10_000_000)).toBeNull();
  });

  it("disparait avec le compte supprime", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    const created = await client.post("/me/exports", { scope: "MY_RECIPES", format: "JSON" });
    await settled(client, created.body.id as string);
    await client.delete("/me", { password: lea.password });
    expect(await db.dataExport.count({ where: { requestedById: lea.id } })).toBe(0);
  });
});
