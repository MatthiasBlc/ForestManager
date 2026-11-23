// Liste de courses (C9) : premiere ouverture, reglages et droits [D141], sections
// de l'espace creees depuis les rayons, renommees, ordonnees, supprimees [D228, D231].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser, grantModule } from "./helpers/factories.ts";
import { groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

beforeAll(async () => {
  await db.module.update({ where: { code: "shopping" }, data: { status: "AVAILABLE" } });
});

async function shoppingGroup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "shopping");
  return f;
}

const base = (spaceId: string) => `/spaces/${spaceId}/shopping`;

async function aisleNames(): Promise<string[]> {
  const aisles = await db.aisle.findMany({
    orderBy: { sortOrder: "asc" },
    include: { translations: { where: { locale: "fr" } } },
  });
  return aisles.map((aisle) => aisle.translations[0]?.name ?? aisle.code);
}

describe("premiere ouverture (D228)", () => {
  it("cree les sections depuis les rayons, dans leur ordre, une seule fois", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const res = await member.get(base(f.spaceId));
    expect(res.status).toBe(200);
    const names = await aisleNames();
    expect(names.length).toBeGreaterThan(0);
    expect(res.body.sections.map((s: { name: string }) => s.name)).toEqual(names);
    expect(res.body.sections.every((s: { aisleId: string | null }) => s.aisleId !== null)).toBe(
      true
    );
    expect(res.body.items).toEqual([]);
    expect(res.body.can).toEqual({ edit: true, setEditRole: false });

    const again = await member.get(base(f.spaceId));
    expect(again.body.sections).toEqual(res.body.sections);
  });

  it("deux premieres ouvertures en meme temps ne doublent pas les sections", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const [a, b] = await Promise.all([member.get(base(f.spaceId)), member.get(base(f.spaceId))]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await db.shoppingSection.count({ where: { spaceId: f.spaceId } })).toBe(
      (await aisleNames()).length
    );
  });

  it("toutes les sections supprimees : elles ne reviennent pas", async () => {
    const f = await shoppingGroup();
    const owner = await loginAs(f.owner, app);
    const { body } = await owner.get(base(f.spaceId));
    for (const section of body.sections as { id: string }[]) {
      expect((await owner.delete(`${base(f.spaceId)}/sections/${section.id}`)).status).toBe(204);
    }
    const res = await owner.get(base(f.spaceId));
    expect(res.body.sections).toEqual([]);
  });

  it("disponible dans l'espace perso", async () => {
    const user = await createUser();
    await grantModule(user.personalSpaceId, "shopping");
    const client = await loginAs(user, app);
    const res = await client.get(base(user.personalSpaceId));
    expect(res.status).toBe(200);
    expect(res.body.can).toEqual({ edit: true, setEditRole: true });
  });

  it("le module doit etre actif dans l'espace", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    expect((await member.get(base(f.spaceId))).body.error.code).toBe("MODULE_001");
  });
});

describe("reglages : role minimal pour modifier la liste (D141)", () => {
  it("MEMBER par defaut ; seul l'OWNER le change, et le droit suit", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const moderator = await loginAs(f.moderator, app);
    const owner = await loginAs(f.owner, app);

    expect((await member.get(`${base(f.spaceId)}/settings`)).body).toEqual({
      editRole: "MEMBER",
      can: { edit: true, setEditRole: false },
    });
    const denied = await moderator.put(`${base(f.spaceId)}/settings`, { editRole: "MODERATOR" });
    expect(denied.body.error.code).toBe("SPACE_002");

    const res = await owner.put(`${base(f.spaceId)}/settings`, { editRole: "MODERATOR" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ editRole: "MODERATOR", can: { edit: true, setEditRole: true } });

    const blocked = await member.post(`${base(f.spaceId)}/sections`, { name: "Ikea" });
    expect(blocked.body.error.code).toBe("SPACE_002");
    expect((await member.get(base(f.spaceId))).body.can).toEqual({
      edit: false,
      setEditRole: false,
    });
    expect((await moderator.post(`${base(f.spaceId)}/sections`, { name: "Ikea" })).status).toBe(
      201
    );
  });
});

describe("sections de l'espace (D231)", () => {
  it("ajoute en fin, refuse un nom deja pris (sans casse ni accents)", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    await member.get(base(f.spaceId));
    const res = await member.post(`${base(f.spaceId)}/sections`, { name: " Épicerie asiatique " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Épicerie asiatique", aisleId: null });
    const list = await member.get(base(f.spaceId));
    expect(list.body.sections.at(-1)).toEqual(res.body);

    const duplicate = await member.post(`${base(f.spaceId)}/sections`, {
      name: "epicerie ASIATIQUE",
    });
    expect(duplicate.body.error.code).toBe("SHOPPING_003");
  });

  it("renomme ; refuse le nom d'une autre section ; section d'un autre espace introuvable", async () => {
    const f = await shoppingGroup();
    const other = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const { body } = await member.get(base(f.spaceId));
    const [first, second] = body.sections as { id: string; name: string }[];
    if (!first || !second) throw new Error("sections expected");

    const res = await member.patch(`${base(f.spaceId)}/sections/${first.id}`, { name: "Marche" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: first.id, name: "Marche" });
    expect(
      (await member.patch(`${base(f.spaceId)}/sections/${first.id}`, { name: "marche" })).status
    ).toBe(200);
    const taken = await member.patch(`${base(f.spaceId)}/sections/${second.id}`, {
      name: "MARCHE",
    });
    expect(taken.body.error.code).toBe("SHOPPING_003");

    const otherOwner = await loginAs(other.owner, app);
    await otherOwner.get(base(other.spaceId));
    const missing = await otherOwner.patch(`${base(other.spaceId)}/sections/${first.id}`, {
      name: "x",
    });
    expect(missing.body.error.code).toBe("SHOPPING_002");
  });

  it("ordre complet des sections, chaque section une seule fois", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const { body } = await member.get(base(f.spaceId));
    const ids = (body.sections as { id: string }[]).map((s) => s.id);
    const reversed = [...ids].reverse();

    const res = await member.put(`${base(f.spaceId)}/sections/order`, { ids: reversed });
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string }) => s.id)).toEqual(reversed);
    expect(
      (await member.get(base(f.spaceId))).body.sections.map((s: { id: string }) => s.id)
    ).toEqual(reversed);

    const partial = await member.put(`${base(f.spaceId)}/sections/order`, {
      ids: reversed.slice(1),
    });
    expect(partial.body.error.code).toBe("SHOPPING_004");
  });

  it("plafond de sections par espace", async () => {
    const f = await shoppingGroup();
    const member = await loginAs(f.member, app);
    const { body } = await member.get(base(f.spaceId));
    const count = (body.sections as unknown[]).length;
    await db.shoppingSection.createMany({
      data: Array.from({ length: 30 - count }, (_, i) => ({
        spaceId: f.spaceId,
        name: `Section ${i}`,
        sortOrder: count + i,
      })),
    });
    const res = await member.post(`${base(f.spaceId)}/sections`, { name: "Une de trop" });
    expect(res.body.error.code).toBe("SHOPPING_006");
  });
});
