// Admin, C4.5 : espaces (A09) et moderation (A09b, D52, D121, D122, D178).
import { beforeAll, describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const OPEN = { reason: "MEMBER_REPORT", note: "Signalement de Sam : recette injurieuse" };

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;

beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
});

async function lastAudit() {
  return db.adminAuditLog.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Espace groupe de lea avec sam ; une recette de lea, une de sam. */
async function world(name = "Colloc") {
  const lea = await createUser();
  const sam = await createUser();
  const space = await createSpace(lea.id, { name });
  await addMember(space.id, sam.id);
  const asLea = await loginAs(lea, app);
  const asSam = await loginAs(sam, app);
  const leaRecipe = await createRecipe(asLea, space.id, { title: "Tarte de Lea" });
  const samRecipe = await createRecipe(asSam, space.id, { title: "Soupe de Sam" });
  return { lea, sam, space, asLea, asSam, leaRecipe, samRecipe };
}

const moderation = (spaceId: string) => `/admin/moderation/${spaceId}`;

async function openAccess(spaceId: string) {
  const res = await client.post(`/admin/spaces/${spaceId}/moderation`, OPEN);
  expect(res.status).toBe(201);
  return res.body as { id: string; expiresAt: string };
}

describe("acces aux routes", () => {
  it("demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/spaces"),
      anonymous.post(`/admin/spaces/${UNKNOWN}/restore`),
      anonymous.post(`/admin/spaces/${UNKNOWN}/moderation`, OPEN),
      anonymous.get(moderation(UNKNOWN)),
      anonymous.post(`${moderation(UNKNOWN)}/close`),
      anonymous.post(`${moderation(UNKNOWN)}/delete-space`, { note: "x" }),
      anonymous.get(`${moderation(UNKNOWN)}/recipes/${UNKNOWN}`),
      anonymous.post(`${moderation(UNKNOWN)}/recipes/${UNKNOWN}/hide`, { note: "x" }),
      anonymous.post(`${moderation(UNKNOWN)}/recipes/${UNKNOWN}/unhide`),
      anonymous.post(`${moderation(UNKNOWN)}/recipes/${UNKNOWN}/remove`, { note: "x" }),
      anonymous.post(`${moderation(UNKNOWN)}/recipes/${UNKNOWN}/delete`, { note: "x" }),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
  });
});

describe("liste des espaces (A09)", () => {
  it("groupes : OWNER, membres, recettes, modules ; compteurs ; recherche par nom ou OWNER", async () => {
    const { lea, space } = await world("Famille Liste");
    const res = await client.get("/admin/spaces?query=famille liste");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: space.id,
        name: "Famille Liste",
        kind: "GROUP",
        owner: lea.username,
        memberCount: 2,
        recipeCount: 2,
        modules: ["recipes"],
        deletedAt: null,
      }),
    ]);
    expect(res.body.counts.GROUP).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.PERSONAL).toBeGreaterThanOrEqual(2);
    const byOwner = await client.get(`/admin/spaces?query=${lea.username}`);
    expect(byOwner.body.data.map((s: { id: string }) => s.id)).toContain(space.id);
    const personal = await client.get(`/admin/spaces?filter=PERSONAL&query=${lea.username}`);
    expect(personal.body.data[0]).toMatchObject({ kind: "PERSONAL", owner: lea.username });
  });

  it("en suppression : purge prevue, restauration a la demande de l'OWNER ; audit", async () => {
    const { space, asLea } = await world("Vacances");
    await asLea.delete(`/spaces/${space.id}`);
    const deleting = await client.get("/admin/spaces?filter=DELETING&query=vacances");
    expect(deleting.body.data[0]).toMatchObject({ id: space.id });
    expect(deleting.body.data[0].purgeAfter).not.toBeNull();
    expect((await client.get("/admin/spaces?query=vacances")).body.data).toEqual([]);

    const restored = await client.post(`/admin/spaces/${space.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ deletedAt: null, purgeAfter: null });
    expect(await lastAudit()).toMatchObject({ action: "space.restored", targetId: space.id });
    expect((await client.post(`/admin/spaces/${space.id}/restore`)).body.error.code).toBe(
      "ADMIN_015"
    );
  });
});

describe("acces de moderation (A09b)", () => {
  it("motif obligatoire, 30 minutes, audit ; sans acces ou expire : refuse", async () => {
    const { space, leaRecipe, samRecipe } = await world();
    expect((await client.get(moderation(space.id))).body.error.code).toBe("ADMIN_013");
    expect(
      (await client.post(`/admin/spaces/${space.id}/moderation`, { reason: "OTHER", note: " " }))
        .body.error.code
    ).toBe("VALIDATION_001");
    expect((await client.post(`/admin/spaces/${UNKNOWN}/moderation`, OPEN)).body.error.code).toBe(
      "ADMIN_008"
    );

    const before = Date.now();
    const access = await openAccess(space.id);
    const ttl = Date.parse(access.expiresAt) - before;
    expect(ttl).toBeGreaterThan(29 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);
    expect(await lastAudit()).toMatchObject({
      action: "moderation.opened",
      targetType: "space",
      targetId: space.id,
      data: OPEN,
    });

    const view = await client.get(moderation(space.id));
    expect(view.status).toBe(200);
    expect(view.body.access).toMatchObject({ reason: "MEMBER_REPORT", note: OPEN.note });
    expect(view.body.recipes.map((r: { id: string }) => r.id).sort()).toEqual(
      [leaRecipe.id, samRecipe.id].sort()
    );

    const detail = await client.get(`${moderation(space.id)}/recipes/${leaRecipe.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      title: "Tarte de Lea",
      can: { edit: false, delete: false, share: false, removeFromSpace: false },
    });

    await db.moderationAccess.updateMany({
      where: { spaceId: space.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await client.get(moderation(space.id))).body.error.code).toBe("ADMIN_013");
  });

  it("fermer l'acces avant la fin", async () => {
    const { space } = await world();
    await openAccess(space.id);
    expect((await client.post(`${moderation(space.id)}/close`)).status).toBe(204);
    expect(await lastAudit()).toMatchObject({ action: "moderation.closed", targetId: space.id });
    expect((await client.get(moderation(space.id))).body.error.code).toBe("ADMIN_013");
  });
});

describe("actions de moderation (D122, D178)", () => {
  it("masquer : cachee aux membres, visible de son auteur avec le motif ; reafficher", async () => {
    const { space, asLea, asSam, samRecipe } = await world();
    await openAccess(space.id);
    const hide = await client.post(`${moderation(space.id)}/recipes/${samRecipe.id}/hide`, {
      note: "Propos injurieux",
    });
    expect(hide.status).toBe(204);
    expect(await lastAudit()).toMatchObject({
      action: "recipe.hidden",
      targetId: samRecipe.id,
      data: { note: "Propos injurieux", spaceId: space.id },
    });

    const recipes = `/spaces/${space.id}/recipes`;
    const leaList = (await asLea.get(recipes)).body.data as { id: string }[];
    expect(leaList.map((r) => r.id)).not.toContain(samRecipe.id);
    expect((await asLea.get(`${recipes}/${samRecipe.id}`)).body.error.code).toBe("RECIPE_001");
    const samList = (await asSam.get(recipes)).body.data as { id: string }[];
    expect(samList.map((r) => r.id)).toContain(samRecipe.id);
    expect((await asSam.get(`${recipes}/${samRecipe.id}`)).body.hidden).toEqual({
      reason: "Propos injurieux",
    });
    const view = await client.get(moderation(space.id));
    expect(view.body.recipes.find((r: { id: string }) => r.id === samRecipe.id).hiddenReason).toBe(
      "Propos injurieux"
    );

    expect(
      (await client.post(`${moderation(space.id)}/recipes/${samRecipe.id}/unhide`)).status
    ).toBe(204);
    expect(await lastAudit()).toMatchObject({ action: "recipe.unhidden" });
    expect((await asLea.get(`${recipes}/${samRecipe.id}`)).body.hidden).toBeNull();
  });

  it("retirer d'un espace de partage : la recette reste chez son auteur", async () => {
    const { lea, space, asLea, leaRecipe } = await world();
    const other = await createSpace(lea.id, { name: "Amis" });
    const shared = await asLea.put(`/spaces/${space.id}/recipes/${leaRecipe.id}/shares`, {
      spaceIds: [other.id],
    });
    expect(shared.status).toBe(200);
    await openAccess(other.id);
    const view = await client.get(moderation(other.id));
    expect(view.body.recipes).toEqual([
      expect.objectContaining({ id: leaRecipe.id, atHome: false }),
    ]);

    const removed = await client.post(`${moderation(other.id)}/recipes/${leaRecipe.id}/remove`, {
      note: "Hors sujet dans cet espace",
    });
    expect(removed.status).toBe(204);
    expect(await lastAudit()).toMatchObject({ action: "recipe.removed", targetId: leaRecipe.id });
    expect((await client.get(moderation(other.id))).body.recipes).toEqual([]);
    expect((await asLea.get(`/spaces/${space.id}/recipes/${leaRecipe.id}`)).status).toBe(200);

    await openAccess(space.id);
    expect(
      (await client.post(`${moderation(space.id)}/recipes/${leaRecipe.id}/remove`, { note: "x" }))
        .body.error.code
    ).toBe("ADMIN_014");
  });

  it("supprimer une recette, puis l'espace ; recette hors de l'espace refusee", async () => {
    const { space, asLea, leaRecipe } = await world();
    const elsewhere = await world("Ailleurs");
    await openAccess(space.id);
    expect(
      (
        await client.post(`${moderation(space.id)}/recipes/${elsewhere.leaRecipe.id}/delete`, {
          note: "x",
        })
      ).body.error.code
    ).toBe("ADMIN_008");

    const deleted = await client.post(`${moderation(space.id)}/recipes/${leaRecipe.id}/delete`, {
      note: "Contenu illicite",
    });
    expect(deleted.status).toBe(204);
    expect(await lastAudit()).toMatchObject({ action: "recipe.deleted", targetId: leaRecipe.id });
    expect((await asLea.get(`/spaces/${space.id}/recipes/${leaRecipe.id}`)).status).toBe(404);

    const gone = await client.post(`${moderation(space.id)}/delete-space`, {
      note: "Espace dedie a du contenu illicite",
    });
    expect(gone.status).toBe(204);
    expect(await lastAudit()).toMatchObject({ action: "space.deleted", targetId: space.id });
    const row = await db.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.purgeAfter).not.toBeNull();
    // Plus d'acces sur un espace supprime.
    expect((await client.get(moderation(space.id))).body.error.code).toBe("ADMIN_013");
  });
});
