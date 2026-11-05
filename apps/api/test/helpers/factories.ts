// Fabriques qui enregistrent en base les donnees de @fm/test-utils [D79].
// Elles reproduisent l'etat obtenu par les vraies routes (espace perso cree
// avec le compte, Recettes accorde et actif dans tout nouvel espace [D33]).
import type { SpaceRole } from "@fm/shared";
import { buildSpace, buildUser, type SpaceData, type UserData } from "@fm/test-utils";

import { db } from "./db.ts";

/** Hash argon2 de TEST_PASSWORD, calcule une fois par fichier (setup.ts). */
let passwordHash = "";
export function setTestPasswordHash(hash: string): void {
  passwordHash = hash;
}

async function grantDefaultModules(spaceId: string): Promise<void> {
  const defaults = await db.module.findMany({ where: { isDefault: true } });
  for (const [index, module] of defaults.entries()) {
    await db.spaceModule.create({
      data: {
        spaceId,
        moduleCode: module.code,
        enabled: true,
        enabledChangedAt: new Date(),
        sortOrder: index,
      },
    });
  }
}

export async function createUser(overrides: Partial<UserData> = {}) {
  const data = buildUser(overrides);
  const user = await db.user.create({
    data: { email: data.email, username: data.username, passwordHash },
  });
  const personalSpace = await db.space.create({
    data: {
      kind: "PERSONAL",
      name: data.username,
      personalUserId: user.id,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await grantDefaultModules(personalSpace.id);
  return { ...user, password: data.password, personalSpaceId: personalSpace.id };
}

/** Espace groupe avec son OWNER. */
export async function createSpace(ownerId: string, overrides: Partial<SpaceData> = {}) {
  const data = buildSpace(overrides);
  const space = await db.space.create({
    data: { kind: "GROUP", ...data, memberships: { create: { userId: ownerId, role: "OWNER" } } },
  });
  await grantDefaultModules(space.id);
  return space;
}

export async function addMember(spaceId: string, userId: string, role: SpaceRole = "MEMBER") {
  return db.membership.create({ data: { spaceId, userId, role } });
}

/** Accorde (et active par defaut) un module a un espace, comme le ferait le super admin. */
export async function grantModule(spaceId: string, moduleCode: string, enabled = true) {
  return db.spaceModule.upsert({
    where: { spaceId_moduleCode: { spaceId, moduleCode } },
    create: { spaceId, moduleCode, enabled, enabledChangedAt: enabled ? new Date() : null },
    update: { revokedAt: null, enabled },
  });
}
