import { describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";
import { ACTORS, clientAs, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

describe("unites et tags globaux (seed)", () => {
  it("liste les unites avec leur nom francais ; connecte seulement", async () => {
    const anonymous = await createClient(app);
    expect((await anonymous.get("/units")).body.error.code).toBe("AUTH_001");
    const client = await loginAs(await createUser(), app);
    const res = await client.get("/units");
    expect(res.status).toBe(200);
    const byCode = Object.fromEntries(
      (res.body.data as { code: string }[]).map((u) => [u.code, u])
    );
    expect(byCode.g).toMatchObject({
      dimension: "MASS",
      toBase: 1,
      metric: true,
      abbreviation: "g",
    });
    expect(byCode.tbsp).toMatchObject({
      dimension: "VOLUME",
      toBase: 15,
      metric: false,
      abbreviation: "c. à soupe",
    });
    expect(byCode.piece).toMatchObject({ dimension: "COUNT", toBase: null });
  });

  it("liste les tags globaux", async () => {
    const client = await loginAs(await createUser(), app);
    const res = await client.get("/tags");
    expect(res.status).toBe(200);
    expect((res.body.data as { name: string }[]).map((t) => t.name)).toContain("Végétarien");
  });
});

describe("ingredients (D09, D120)", () => {
  it("cree a la volee, retrouve sans tenir compte de la casse ni des accents", async () => {
    const client = await loginAs(await createUser(), app);
    const created = await client.post("/ingredients", { name: "Crème fraîche" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Crème fraîche" });
    const row = await db.ingredient.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.status).toBe("NEW");

    const again = await client.post("/ingredients", { name: "  creme   FRAICHE " });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(created.body.id);

    const found = await client.get("/ingredients?q=CREM");
    expect(found.body.data.map((i: { id: string }) => i.id)).toContain(created.body.id);
    expect((await client.get("/ingredients?q=")).body.error.code).toBe("VALIDATION_001");
  });

  it("un ingredient fusionne est propose comme synonyme de sa cible", async () => {
    const client = await loginAs(await createUser(), app);
    const target = await client.post("/ingredients", { name: "Courgette" });
    const alias = await client.post("/ingredients", { name: "Zucchini" });
    await db.ingredient.update({
      where: { id: alias.body.id },
      data: { status: "MERGED", mergedIntoId: target.body.id },
    });
    const res = await client.get("/ingredients?q=zucc");
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: target.body.id, name: "Courgette", matchedName: "Zucchini" }),
    ]);
    const reused = await client.post("/ingredients", { name: "zucchini" });
    expect(reused.body.id).toBe(target.body.id);
  });

  it("refuse un nom vide ou trop long", async () => {
    const client = await loginAs(await createUser(), app);
    expect((await client.post("/ingredients", { name: " " })).body.error.code).toBe(
      "VALIDATION_001"
    );
    expect((await client.post("/ingredients", { name: "x".repeat(81) })).body.error.code).toBe(
      "VALIDATION_001"
    );
  });
});

describe("tags d'espace (D08, D19)", () => {
  it("un membre cree un tag (meme nom = meme tag), la liste est propre a l'espace", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const path = `/spaces/${f.spaceId}/recipes/tags`;
    const created = await member.post(path, { name: "Plat du dimanche" });
    expect(created.status).toBe(201);
    const again = await member.post(path, { name: "plat du DIMANCHE" });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(created.body.id);
    expect((await member.get(path)).body.data.map((t: { name: string }) => t.name)).toEqual([
      "Plat du dimanche",
    ]);
    const other = await loginAs(f.outsider, app);
    const outsiderSpace = (await other.get("/spaces")).body.data[0].id as string;
    expect((await other.get(`/spaces/${outsiderSpace}/recipes/tags`)).body.data).toEqual([]);
  });

  it("un moderateur renomme, fusionne, supprime ; refus si le nom existe deja", async () => {
    const f = await groupFixture();
    const moderator = await loginAs(f.moderator, app);
    const path = `/spaces/${f.spaceId}/recipes/tags`;
    const a = await moderator.post(path, { name: "Rapide" });
    const b = await moderator.post(path, { name: "Express" });
    expect(
      (await moderator.patch(`${path}/${a.body.id}`, { name: "Express" })).body.error.code
    ).toBe("RECIPE_002");
    const renamed = await moderator.patch(`${path}/${a.body.id}`, { name: "Vite fait" });
    expect(renamed.body).toMatchObject({ id: a.body.id, name: "Vite fait" });
    expect(
      (await moderator.post(`${path}/${b.body.id}/merge`, { intoTagId: a.body.id })).status
    ).toBe(204);
    const merged = await db.tag.findUniqueOrThrow({ where: { id: b.body.id } });
    expect(merged.mergedIntoId).toBe(a.body.id);
    expect((await moderator.get(path)).body.data.map((t: { name: string }) => t.name)).toEqual([
      "Vite fait",
    ]);
    expect((await moderator.delete(`${path}/${a.body.id}`)).status).toBe(204);
    expect((await moderator.get(path)).body.data).toEqual([]);
  });

  for (const actor of ACTORS) {
    const allowed = actor === "MODERATOR" || actor === "OWNER";
    it(`renommer un tag d'espace - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await groupFixture();
      const owner = await loginAs(f.owner, app);
      const tag = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Hiver" });
      const client = await clientAs(actor, f, app);
      const res = await client.patch(`/spaces/${f.spaceId}/recipes/tags/${tag.body.id}`, {
        name: "Saison froide",
      });
      const expected = {
        anonymous: "AUTH_001",
        outsider: "SPACE_001",
        MEMBER: "SPACE_002",
      } as const;
      if (allowed) expect(res.status).toBe(200);
      else expect(res.body.error.code).toBe(expected[actor]);
    });
  }
});
