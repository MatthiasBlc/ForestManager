// Changelog (C6.6) [D187, D127, D128] : brouillon cree au demarrage, A10, Nouveautes.
import { beforeAll, describe, expect, it } from "vitest";

import { seed } from "../prisma/seed.ts";
import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";

const app = createTestApp();

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;

const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const EMPTY = { features: [], improvements: [], fixes: [] };
const CONTENT = {
  features: [{ text: "Les recettes composees arrivent" }],
  improvements: [],
  fixes: [{ text: "Quantites en cuilleres additionnees" }],
};

beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
});

async function entry(version: string, data: Record<string, unknown> = {}) {
  return db.changelogEntry.create({
    data: { version, title: `Version ${version}`, content: CONTENT, ...data },
  });
}

describe("brouillon cree au demarrage (seed)", () => {
  it("cree la version de release.json si elle n'existe pas, sans jamais l'ecraser", async () => {
    await seed(db, { release: { version: "9.1.0", content: CONTENT } });
    const created = await db.changelogEntry.findUniqueOrThrow({ where: { version: "9.1.0" } });
    expect(created).toMatchObject({ title: "Version 9.1.0", status: "DRAFT", content: CONTENT });

    await db.changelogEntry.update({ where: { id: created.id }, data: { title: "Reformule" } });
    await seed(db, { release: { version: "9.1.0", content: EMPTY } });
    const again = await db.changelogEntry.findUniqueOrThrow({ where: { version: "9.1.0" } });
    expect(again).toMatchObject({ title: "Reformule", content: CONTENT });
  });

  it("sans release.json, rien n'est cree", async () => {
    const before = await db.changelogEntry.count();
    await seed(db, { release: null });
    expect(await db.changelogEntry.count()).toBe(before);
  });
});

describe("A10 : versions de l'admin", () => {
  it("demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/releases"),
      anonymous.patch(`/admin/releases/${UNKNOWN}`, { title: "T", content: EMPTY }),
      anonymous.post(`/admin/releases/${UNKNOWN}/publish`, { notify: false }),
      anonymous.post(`/admin/releases/${UNKNOWN}/hide`),
      anonymous.post(`/admin/releases/${UNKNOWN}/show`),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
  });

  it("toutes les versions, la plus recente d'abord (ordre numerique)", async () => {
    await entry("8.9.0", { status: "PUBLISHED", publishedAt: new Date() });
    await entry("8.10.0");
    const res = await client.get("/admin/releases");
    expect(res.status).toBe(200);
    const versions = (res.body.data as { version: string }[]).map((r) => r.version);
    expect(versions.indexOf("8.10.0")).toBeLessThan(versions.indexOf("8.9.0"));
    expect(res.body.data.find((r: { version: string }) => r.version === "8.10.0")).toMatchObject({
      status: "DRAFT",
      publishedAt: null,
      notifiedAt: null,
      content: CONTENT,
    });
  });

  it("modifie le titre et les items d'un brouillon ou d'une version publiee, avec audit", async () => {
    const draft = await entry("7.0.0");
    const res = await client.patch(`/admin/releases/${draft.id}`, {
      title: "  Les recettes composees  ",
      content: { ...EMPTY, improvements: [{ text: "Planning plus rapide" }] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Les recettes composees",
      content: { features: [], improvements: [{ text: "Planning plus rapide" }], fixes: [] },
    });
    const log = await db.adminAuditLog.findFirstOrThrow({
      where: { action: "release.updated", targetId: draft.id },
    });
    expect(log.data).toEqual({ version: "7.0.0" });

    const published = await entry("7.0.1", { status: "PUBLISHED", publishedAt: new Date() });
    expect(
      (await client.patch(`/admin/releases/${published.id}`, { title: "T", content: CONTENT }))
        .status
    ).toBe(200);
  });

  it("refuse une version masquee, inconnue, ou un contenu invalide", async () => {
    const hidden = await entry("7.1.0", { status: "HIDDEN", publishedAt: new Date() });
    const body = { title: "T", content: CONTENT };
    expect((await client.patch(`/admin/releases/${hidden.id}`, body)).body.error.code).toBe(
      "CHANGELOG_002"
    );
    expect((await client.patch(`/admin/releases/${UNKNOWN}`, body)).body.error.code).toBe(
      "CHANGELOG_001"
    );
    const invalid = await client.patch(`/admin/releases/${hidden.id}`, {
      title: "",
      content: CONTENT,
    });
    expect(invalid.status).toBe(400);
  });
});

describe("publier, masquer, reafficher", () => {
  it("publie et previent chaque utilisateur actif qui garde la categorie [D127]", async () => {
    const reader = await createUser();
    const muted = await createUser();
    const gone = await createUser();
    await db.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    await db.notificationPreference.create({
      data: { userId: muted.id, category: "core.releases", enabled: false },
    });
    const draft = await entry("6.0.0");

    const res = await client.post(`/admin/releases/${draft.id}/publish`, { notify: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PUBLISHED");
    expect(res.body.publishedAt).not.toBeNull();
    expect(res.body.notifiedAt).not.toBeNull();

    const notified = await db.notification.findMany({ where: { type: "core.release.published" } });
    const users = notified.map((n) => n.userId);
    expect(users).toContain(reader.id);
    expect(users).not.toContain(muted.id);
    expect(users).not.toContain(gone.id);
    expect(notified.find((n) => n.userId === reader.id)).toMatchObject({
      category: "core.releases",
      spaceId: null,
      data: { version: "6.0.0", title: "Version 6.0.0" },
      url: "/news",
    });
    expect(
      await db.adminAuditLog.count({
        where: { action: "release.published", targetId: draft.id },
      })
    ).toBe(1);

    // Deja publiee : refusee.
    const again = await client.post(`/admin/releases/${draft.id}/publish`, { notify: true });
    expect(again.body.error.code).toBe("CHANGELOG_002");
  });

  it("publie sans prevenir ; refuse une version sans ligne", async () => {
    const quiet = await entry("6.1.0");
    const res = await client.post(`/admin/releases/${quiet.id}/publish`, { notify: false });
    expect(res.body).toMatchObject({ status: "PUBLISHED", notifiedAt: null });
    expect(
      await db.notification.count({
        where: { type: "core.release.published", data: { path: ["version"], equals: "6.1.0" } },
      })
    ).toBe(0);

    const empty = await entry("6.2.0", { content: EMPTY });
    const refused = await client.post(`/admin/releases/${empty.id}/publish`, { notify: false });
    expect(refused.body.error.code).toBe("CHANGELOG_003");
  });

  it("masque une version publiee puis la reaffiche, sans nouvelle notification", async () => {
    await createUser();
    const release = await entry("5.0.0");
    await client.post(`/admin/releases/${release.id}/publish`, { notify: true });
    const before = await db.notification.count({ where: { type: "core.release.published" } });

    const hidden = await client.post(`/admin/releases/${release.id}/hide`);
    expect(hidden.body.status).toBe("HIDDEN");
    const shown = await client.post(`/admin/releases/${release.id}/show`);
    expect(shown.body.status).toBe("PUBLISHED");
    expect(await db.notification.count({ where: { type: "core.release.published" } })).toBe(before);
    const actions = (
      await db.adminAuditLog.findMany({
        where: { targetId: release.id },
        orderBy: { createdAt: "asc" },
      })
    ).map((log) => log.action);
    expect(actions).toEqual(["release.published", "release.hidden", "release.shown"]);
  });

  it("masquer un brouillon ou reafficher une version visible est refuse", async () => {
    const draft = await entry("5.1.0");
    expect((await client.post(`/admin/releases/${draft.id}/hide`)).body.error.code).toBe(
      "CHANGELOG_002"
    );
    expect((await client.post(`/admin/releases/${draft.id}/show`)).body.error.code).toBe(
      "CHANGELOG_002"
    );
  });
});

describe("Nouveautes : versions publiees pour les utilisateurs", () => {
  it("publiees seulement, la plus recente d'abord ; connexion requise", async () => {
    await db.changelogEntry.deleteMany();
    const day = 24 * 3600 * 1000;
    await entry("4.0.0", { status: "PUBLISHED", publishedAt: new Date(Date.now() - 2 * day) });
    await entry("4.1.0", { status: "PUBLISHED", publishedAt: new Date(Date.now() - day) });
    await entry("4.2.0");
    await entry("3.9.0", { status: "HIDDEN", publishedAt: new Date(Date.now() - 3 * day) });

    const anonymous = await createClient(app);
    expect((await anonymous.get("/releases")).status).toBe(401);

    const user = await createUser();
    const reader = await loginAs(user, app);
    const res = await reader.get("/releases");
    expect(res.status).toBe(200);
    expect((res.body.data as { version: string }[]).map((r) => r.version)).toEqual([
      "4.1.0",
      "4.0.0",
    ]);
    expect(res.body.data[0]).toEqual({
      version: "4.1.0",
      title: "Version 4.1.0",
      content: CONTENT,
      publishedAt: expect.any(String),
    });
  });
});
