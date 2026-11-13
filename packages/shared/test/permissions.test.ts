import { describe, expect, it } from "vitest";

import {
  ACTORS,
  type Actor,
  can,
  CORE_PERMISSIONS,
  type CorePermissionKey,
  isAllowed,
  modulePermissionDefinition,
  type PermissionContext,
} from "../src/permissions/index.ts";
import type { SpaceKind } from "../src/schemas/common.ts";

// Matrice recopiee a la main depuis 12-Permissions.md (Compte, Espace perso,
// Espace groupe, Modules), independamment de l'implementation.
// Colonnes : VIS, CON (USER), MEM, MOD, OWN. "Cond." et "Soi" = autorise par le role.
type Row = readonly [vis: 0 | 1, con: 0 | 1, mem: 0 | 1, mod: 0 | 1, own: 0 | 1];

const ACCOUNT: Record<string, readonly [vis: 0 | 1, user: 0 | 1]> = {
  "account.register": [1, 0],
  "account.login": [1, 0],
  "account.recover": [1, 0],
  "account.update": [0, 1],
  "account.delete": [0, 1],
  "spaces.create": [0, 1],
};

const GROUP: Record<string, Row> = {
  "space.view": [0, 0, 1, 1, 1],
  "space.members.view": [0, 0, 1, 1, 1],
  "space.update": [0, 0, 0, 1, 1],
  "space.delete": [0, 0, 0, 0, 1],
  "space.restore": [0, 0, 0, 0, 1],
  "space.leave": [0, 0, 1, 1, 1],
  "space.ownership.transfer": [0, 0, 0, 0, 1],
  "space.join": [0, 1, 0, 0, 0],
  "space.invitation.respond": [0, 1, 0, 0, 0],
  "space.invites.manage": [0, 0, 0, 1, 1],
  "space.members.exclude.member": [0, 0, 0, 1, 1],
  "space.members.exclude.moderator": [0, 0, 0, 0, 1],
  "space.members.role": [0, 0, 0, 0, 1],
  "space.export": [0, 0, 0, 0, 1],
  "space.activity.view": [0, 0, 1, 1, 1],
  "space.modules.view": [0, 0, 1, 1, 1],
  "space.modules.manage": [0, 0, 0, 0, 1],
};

// Espace perso : seul son OWNER y agit ; ni invitation, ni depart, ni suppression.
const PERSONAL: Record<string, Row> = {
  ...Object.fromEntries(Object.keys(GROUP).map((key) => [key, [0, 0, 0, 0, 0] as Row])),
  "space.view": [0, 0, 0, 0, 1],
  "space.members.view": [0, 0, 0, 0, 1],
  "space.update": [0, 0, 0, 0, 1],
  "space.modules.view": [0, 0, 0, 0, 1],
  "space.modules.manage": [0, 0, 0, 0, 1],
};

function contextFor(actor: Actor, kind: SpaceKind): PermissionContext {
  if (actor === "VISITOR") return { authenticated: false, space: { kind, role: null } };
  if (actor === "USER") return { authenticated: true, space: { kind, role: null } };
  return { authenticated: true, space: { kind, role: actor } };
}

describe("matrice du socle", () => {
  it("couvre exactement les cles declarees", () => {
    expect(Object.keys(CORE_PERMISSIONS).sort()).toEqual(
      [...Object.keys(ACCOUNT), ...Object.keys(GROUP)].sort()
    );
  });

  const accountCases = Object.entries(ACCOUNT).flatMap(([key, [vis, user]]) => [
    { key, authenticated: false, expected: vis === 1 },
    { key, authenticated: true, expected: user === 1 },
  ]);
  it.each(accountCases)(
    "$key connecte=$authenticated -> $expected",
    ({ key, authenticated, expected }) => {
      expect(can({ authenticated }, key as CorePermissionKey)).toBe(expected);
      // Une action de compte ne depend pas de l'espace eventuel.
      expect(
        can({ authenticated, space: { kind: "GROUP", role: "OWNER" } }, key as CorePermissionKey)
      ).toBe(expected);
    }
  );

  const spaceCases = (["GROUP", "PERSONAL"] as const).flatMap((kind) =>
    Object.entries(kind === "GROUP" ? GROUP : PERSONAL).flatMap(([key, row]) =>
      ACTORS.map((actor, index) => ({ kind, key, actor, expected: row[index] === 1 }))
    )
  );
  it.each(spaceCases)("$kind $key $actor -> $expected", ({ kind, key, actor, expected }) => {
    expect(can(contextFor(actor, kind), key as CorePermissionKey)).toBe(expected);
  });

  it("refuse une permission d'espace sans espace", () => {
    expect(can({ authenticated: true }, "space.view")).toBe(false);
  });
});

describe("permissions de module", () => {
  const groupCtx = (role: "MEMBER" | "MODERATOR" | "OWNER" | null): PermissionContext => ({
    authenticated: true,
    space: { kind: "GROUP", role },
  });

  it("applique le role minimal dans un groupe", () => {
    const def = modulePermissionDefinition({ minRole: "MODERATOR" });
    expect(isAllowed(def, groupCtx("MEMBER"))).toBe(false);
    expect(isAllowed(def, groupCtx("MODERATOR"))).toBe(true);
    expect(isAllowed(def, groupCtx("OWNER"))).toBe(true);
    expect(isAllowed(def, groupCtx(null))).toBe(false);
    expect(isAllowed(def, { authenticated: false, space: { kind: "GROUP", role: null } })).toBe(
      false
    );
  });

  it("donne tout a l'OWNER de l'espace perso", () => {
    const def = modulePermissionDefinition({ minRole: "OWNER" });
    expect(
      isAllowed(def, { authenticated: true, space: { kind: "PERSONAL", role: "OWNER" } })
    ).toBe(true);
  });

  it("n'accepte un role minimal regle par l'OWNER que si la permission est configurable", () => {
    const fixed = modulePermissionDefinition({ minRole: "MEMBER" }, "MODERATOR");
    const configurable = modulePermissionDefinition(
      { minRole: "MEMBER", configurable: true },
      "MODERATOR"
    );
    expect(isAllowed(fixed, groupCtx("MEMBER"))).toBe(true);
    expect(isAllowed(configurable, groupCtx("MEMBER"))).toBe(false);
    expect(isAllowed(configurable, groupCtx("MODERATOR"))).toBe(true);
  });
});
