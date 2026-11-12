import { describe, expect, it } from "vitest";

import { seed } from "../prisma/seed.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser, grantModule } from "./helpers/factories.ts";

describe("seed", () => {
  it("cree le catalogue des modules et reste idempotent", async () => {
    await db.module.update({ where: { code: "meal-plan" }, data: { status: "BETA" } });
    await seed(db);
    await seed(db);
    const modules = await db.module.findMany({ orderBy: { sortOrder: "asc" } });
    expect(modules.map((m) => [m.code, m.status, m.isDefault])).toEqual([
      ["recipes", "AVAILABLE", true],
      // Le statut appartient au super admin : le seed ne l'ecrase pas.
      ["meal-plan", "BETA", false],
      ["shopping", "COMING_SOON", false],
    ]);
  });
});

describe("fabriques", () => {
  it("creent un compte avec son espace perso et Recettes actif", async () => {
    const user = await createUser();
    const space = await db.space.findUniqueOrThrow({
      where: { id: user.personalSpaceId },
      include: { memberships: true, modules: true },
    });
    expect(space.kind).toBe("PERSONAL");
    expect(space.memberships).toMatchObject([{ userId: user.id, role: "OWNER" }]);
    expect(space.modules).toMatchObject([{ moduleCode: "recipes", enabled: true }]);
  });

  it("accordent un module", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id);
    const granted = await grantModule(space.id, "meal-plan");
    expect(granted.enabled).toBe(true);
  });
});

describe("contraintes SQL", () => {
  it("un seul OWNER actif par espace", async () => {
    const owner = await createUser();
    const other = await createUser();
    const space = await createSpace(owner.id);
    await expect(addMember(space.id, other.id, "OWNER")).rejects.toThrow();
  });

  it("username unique sans tenir compte de la casse", async () => {
    await createUser({ username: "CaseUser" });
    await expect(createUser({ username: "caseuser", email: "other@test.local" })).rejects.toThrow();
  });

  it("teinte entre 1 et 5 et coherence espace perso", async () => {
    const owner = await createUser();
    await expect(createSpace(owner.id, { tintIndex: 6 })).rejects.toThrow();
    await expect(db.space.create({ data: { kind: "PERSONAL", name: "x" } })).rejects.toThrow();
  });

  it("une seule invitation en attente par personne et par espace", async () => {
    const owner = await createUser();
    const invitee = await createUser();
    const space = await createSpace(owner.id);
    const data = { spaceId: space.id, inviterId: owner.id, inviteeId: invitee.id };
    await db.spaceInvitation.create({ data });
    await expect(db.spaceInvitation.create({ data })).rejects.toThrow();
    await db.spaceInvitation.create({ data: { ...data, status: "DECLINED" } });
  });
});
