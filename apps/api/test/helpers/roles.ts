// Tests de permissions generes depuis la matrice partagee [plan de tests S3] :
// pour chaque route, un test par acteur (anonyme, non-membre, MEMBER,
// MODERATOR, OWNER). Le resultat attendu vient de `can()`, elle-meme testee
// contre la matrice recopiee de 12-Permissions.md.
import { can, type CorePermissionKey, type SpaceRole } from "@fm/shared";
import type { Response } from "supertest";
import { describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs, type Client } from "./app.ts";
import { addMember, createSpace, createUser } from "./factories.ts";

export const ACTORS = ["anonymous", "outsider", "MEMBER", "MODERATOR", "OWNER"] as const;
export type TestActor = (typeof ACTORS)[number];

type User = Awaited<ReturnType<typeof createUser>>;

export interface GroupFixture {
  spaceId: string;
  owner: User;
  moderator: User;
  member: User;
  /** Second membre, cible des exclusions. */
  extra: User;
  outsider: User;
}

/** Espace groupe complet : un utilisateur par role, plus un non-membre. */
export async function groupFixture(): Promise<GroupFixture> {
  const [owner, moderator, member, extra, outsider] = (await Promise.all(
    Array.from({ length: 5 }, () => createUser())
  )) as [User, User, User, User, User];
  const space = await createSpace(owner.id);
  await addMember(space.id, moderator.id, "MODERATOR");
  await addMember(space.id, member.id, "MEMBER");
  await addMember(space.id, extra.id, "MEMBER");
  return { spaceId: space.id, owner, moderator, member, extra, outsider };
}

export async function clientAs(
  actor: TestActor,
  fixture: GroupFixture,
  app = createTestApp()
): Promise<Client> {
  const users: Record<Exclude<TestActor, "anonymous">, User> = {
    outsider: fixture.outsider,
    MEMBER: fixture.member,
    MODERATOR: fixture.moderator,
    OWNER: fixture.owner,
  };
  return actor === "anonymous" ? createClient(app) : loginAs(users[actor], app);
}

export function isAllowedFor(actor: TestActor, key: CorePermissionKey): boolean {
  const role: SpaceRole | null = actor === "anonymous" || actor === "outsider" ? null : actor;
  return can({ authenticated: actor !== "anonymous", space: { kind: "GROUP", role } }, key);
}

/** Verifie la reponse d'un acteur : refus attendu selon son cas, ou passage du controle de droits. */
export function expectPermission(actor: TestActor, allowed: boolean, res: Response): void {
  const code = (res.body as { error?: { code?: string } }).error?.code;
  if (allowed) {
    expect([401, 403], `${actor}: ${res.status} ${JSON.stringify(res.body)}`).not.toContain(
      res.status
    );
    expect(code).not.toBe("SPACE_001");
    return;
  }
  if (actor === "anonymous") expect(code).toBe("AUTH_001");
  else if (actor === "outsider") expect(code).toBe("SPACE_001");
  else expect(code).toBe("SPACE_002");
}

export interface RouteCase {
  name: string;
  key: CorePermissionKey;
  call: (client: Client, fixture: GroupFixture) => Promise<Response>;
}

/** Un test par (route, acteur), chacun sur un espace neuf. */
export function describePermissions(title: string, routes: readonly RouteCase[]): void {
  describe(title, () => {
    for (const route of routes) {
      for (const actor of ACTORS) {
        const allowed = isAllowedFor(actor, route.key);
        it(`${route.name} - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
          const fixture = await groupFixture();
          const client = await clientAs(actor, fixture);
          expectPermission(actor, allowed, await route.call(client, fixture));
        });
      }
    }
  });
}
