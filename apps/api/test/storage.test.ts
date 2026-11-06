// Envoi des photos et avatars du socle [D146, D167] sur le stockage S3 de test.
import { IMAGE_MAX_SIDE, UPLOAD_MAX_BYTES, uploadTicketSchema } from "@fm/shared";
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { sweepStorage } from "../src/core/storage/images.ts";
import { MODULES } from "../src/modules/index.ts";
import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv, testStorage } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { describePermissions } from "./helpers/roles.ts";
import { fetchImage, postToStorage, upload } from "./helpers/storage.ts";
import { webpBytes } from "./helpers/webp.ts";

const app = createTestApp();

async function keysUnder(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  for await (const object of testStorage.list(prefix)) keys.push(object.key);
  return keys;
}

describe("configuration", () => {
  it("annonce l'envoi de photos selon le stockage", async () => {
    const withStorage = await createClient(app);
    expect((await withStorage.get("/config")).body.features.uploads).toBe(true);
    const without = await createClient(createTestApp({ storage: null }));
    expect((await without.get("/config")).body.features.uploads).toBe(false);
  });
});

describe("POST /uploads", () => {
  it("exige d'etre connecte", async () => {
    const client = await createClient(app);
    expect((await client.post("/uploads")).body.error.code).toBe("AUTH_001");
  });

  it("refuse sans stockage configure", async () => {
    const user = await createUser();
    const client = await loginAs(user, createTestApp({ storage: null }));
    const res = await client.post("/uploads");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("STORAGE_001");
  });

  it("donne un formulaire signe de 60 s ; le stockage refuse un fichier trop gros ou d'un autre type", async () => {
    const client = await loginAs(await createUser(), app);
    const res = await client.post("/uploads");
    expect(res.status).toBe(201);
    const ticket = uploadTicketSchema.parse(res.body);
    expect(ticket.maxBytes).toBe(UPLOAD_MAX_BYTES);
    const ttl = new Date(ticket.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(50_000);
    expect(ttl).toBeLessThanOrEqual(60_000);

    expect((await postToStorage(ticket, Buffer.alloc(UPLOAD_MAX_BYTES + 1))).status).toBe(400);
    expect((await postToStorage(ticket, webpBytes(10, 10), "text/html")).status).toBe(400);
    expect((await postToStorage(ticket, webpBytes(10, 10))).ok).toBe(true);
  });
});

describe("avatar du compte", () => {
  it("rattache l'envoi, sert l'image par une URL signee stable, remplace et retire", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const file = webpBytes(256, 256);

    const res = await client.put("/me/avatar", { uploadId: await upload(client, file) });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("X-Amz-Signature=");
    expect(await fetchImage(res.body.url as string)).toEqual(file);

    // Meme URL d'une lecture a l'autre (cache du navigateur).
    const me = await client.get("/me");
    expect(me.body.avatarUrl).toBe(res.body.url);
    const first = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(first.avatarKey).toMatch(new RegExp(`^users/${user.id}/[0-9a-f-]{36}\\.webp$`));
    // Plus rien dans la zone d'attente.
    expect(await keysUnder(`uploads/${user.id}/`)).toEqual([]);

    // Remplacer efface l'ancienne image.
    await client.put("/me/avatar", { uploadId: await upload(client, webpBytes(128, 128)) });
    const second = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(second.avatarKey).not.toBe(first.avatarKey);
    expect(await keysUnder(`users/${user.id}/`)).toEqual([second.avatarKey]);

    const removed = await client.delete("/me/avatar");
    expect(removed.status).toBe(200);
    expect(removed.body.url).toBeNull();
    expect((await client.get("/me")).body.avatarUrl).toBeNull();
    expect(await keysUnder(`users/${user.id}/`)).toEqual([]);
  });

  it("refuse un envoi inconnu, celui d'un autre, ou deja utilise", async () => {
    const [alice, bob] = await Promise.all([createUser(), createUser()]);
    const asAlice = await loginAs(alice, app);
    const asBob = await loginAs(bob, app);

    const unknown = await asAlice.put("/me/avatar", { uploadId: NOT_FOUND_UUID });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("STORAGE_002");

    const bobsUpload = await upload(asBob);
    expect((await asAlice.put("/me/avatar", { uploadId: bobsUpload })).body.error.code).toBe(
      "STORAGE_002"
    );

    const uploadId = await upload(asAlice);
    expect((await asAlice.put("/me/avatar", { uploadId })).status).toBe(200);
    expect((await asAlice.put("/me/avatar", { uploadId })).body.error.code).toBe("STORAGE_002");
  });

  it.each([
    ["un fichier qui n'est pas un WebP", Buffer.from("<svg onload=alert(1)>")],
    ["une image trop grande", webpBytes(IMAGE_MAX_SIDE.avatar + 1, 100)],
    ["une image vide", webpBytes(1, 0, "VP8")],
  ])("refuse %s et l'efface", async (_label, file) => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await client.put("/me/avatar", { uploadId: await upload(client, file) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("STORAGE_003");
    expect(await keysUnder(`uploads/${user.id}/`)).toEqual([]);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).avatarKey).toBeNull();
  });

  it("est visible des autres membres d'un espace commun", async () => {
    const [owner, member] = await Promise.all([createUser(), createUser()]);
    const space = await createSpace(owner.id);
    await addMember(space.id, member.id);
    const asOwner = await loginAs(owner, app);
    const { body } = await asOwner.put("/me/avatar", { uploadId: await upload(asOwner) });

    const members = await (await loginAs(member, app)).get(`/spaces/${space.id}/members`);
    const row = (members.body.data as { user: { id: string; avatarUrl: string | null } }[]).find(
      (m) => m.user.id === owner.id
    );
    expect(row?.user.avatarUrl).toBe(body.url);
  });
});

describePermissions("avatar d'un espace", [
  {
    name: "PUT /spaces/:id/avatar",
    key: "space.update",
    call: async (c, f) => {
      // Envoi fait par l'acteur quand il le peut, sinon un identifiant quelconque.
      const uploadId = await upload(c).catch(() => NOT_FOUND_UUID);
      return c.put(`/spaces/${f.spaceId}/avatar`, { uploadId });
    },
  },
  {
    name: "DELETE /spaces/:id/avatar",
    key: "space.update",
    call: (c, f) => c.delete(`/spaces/${f.spaceId}/avatar`),
  },
]);

describe("avatar d'un espace", () => {
  it("apparait dans la liste et le detail, et l'espace perso a aussi le sien", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id);
    const client = await loginAs(owner, app);

    const res = await client.put(`/spaces/${space.id}/avatar`, { uploadId: await upload(client) });
    expect(res.status).toBe(200);
    expect((await client.get(`/spaces/${space.id}`)).body.avatarUrl).toBe(res.body.url);
    const list = (await client.get("/spaces")).body.data as { id: string; avatarUrl: string }[];
    expect(list.find((s) => s.id === space.id)?.avatarUrl).toBe(res.body.url);

    const personal = await client.put(`/spaces/${owner.personalSpaceId}/avatar`, {
      uploadId: await upload(client),
    });
    expect(personal.status).toBe(200);
  });
});

describe("sweepStorage", () => {
  it("efface les envois abandonnes et les images que la base ne reference plus", async () => {
    const [user, gone] = await Promise.all([createUser(), createUser()]);
    const client = await loginAs(user, app);
    const asGone = await loginAs(gone, app);
    await client.put("/me/avatar", { uploadId: await upload(client) });
    await asGone.put("/me/avatar", { uploadId: await upload(asGone) });
    const pending = await upload(client);
    const kept = (await db.user.findUniqueOrThrow({ where: { id: user.id } })).avatarKey;
    // Compte supprime : la cle n'est plus en base.
    await db.user.update({ where: { id: gone.id }, data: { avatarKey: null } });

    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: MODULES,
      storage: testStorage,
    });

    // Rien de recent n'est touche (un envoi peut etre en cours de rattachement).
    expect(await sweepStorage(ctx, new Date())).toBe(0);
    expect(await keysUnder(`uploads/${user.id}/`)).toEqual([`uploads/${user.id}/${pending}.webp`]);

    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(await sweepStorage(ctx, later)).toBeGreaterThanOrEqual(2);
    expect(await keysUnder(`uploads/${user.id}/`)).toEqual([]);
    expect(await keysUnder(`users/${gone.id}/`)).toEqual([]);
    expect(await keysUnder(`users/${user.id}/`)).toEqual([kept]);
  });
});
