// Liste de courses (C9) : matrice B2, chaque route pour chaque acteur
// (anonyme, non-membre, MEMBER, MODERATOR, OWNER), d'apres les permissions du module [D141].
import { modulePermissionDefinition } from "@fm/shared";
import { beforeAll, describe, it } from "vitest";

import { SHOPPING_PERMISSIONS } from "../src/modules/shopping/permissions.ts";
import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { grantModule } from "./helpers/factories.ts";
import {
  ACTORS,
  allowedFor,
  clientAs,
  expectPermission,
  groupFixture,
  type GroupFixture,
} from "./helpers/roles.ts";

const app = createTestApp();
const ID = "00000000-0000-4000-8000-000000000000";

type Key = keyof typeof SHOPPING_PERMISSIONS;

const ROUTES: readonly {
  name: string;
  key: Key;
  call: (client: Client, base: string) => ReturnType<Client["get"]>;
}[] = [
  { name: "lire la liste", key: "shopping.view", call: (c, b) => c.get(b) },
  { name: "lire les reglages", key: "shopping.view", call: (c, b) => c.get(`${b}/settings`) },
  {
    name: "regler le role minimal",
    key: "shopping.edit-role",
    call: (c, b) => c.put(`${b}/settings`, { editRole: "MEMBER" }),
  },
  {
    name: "ajouter une section",
    key: "shopping.edit",
    call: (c, b) => c.post(`${b}/sections`, { name: "Ikea" }),
  },
  {
    name: "ordonner les sections",
    key: "shopping.edit",
    call: (c, b) => c.put(`${b}/sections/order`, { ids: [ID] }),
  },
  {
    name: "renommer une section",
    key: "shopping.edit",
    call: (c, b) => c.patch(`${b}/sections/${ID}`, { name: "Marche" }),
  },
  {
    name: "supprimer une section",
    key: "shopping.edit",
    call: (c, b) => c.delete(`${b}/sections/${ID}`),
  },
  {
    name: "ajouter un article",
    key: "shopping.edit",
    call: (c, b) => c.post(`${b}/items`, { label: "lait" }),
  },
  {
    name: "ordonner les articles",
    key: "shopping.edit",
    call: (c, b) => c.put(`${b}/items/order`, { sectionId: null, ids: [ID] }),
  },
  {
    name: "cocher un article",
    key: "shopping.edit",
    call: (c, b) => c.patch(`${b}/items/${ID}`, { checked: true }),
  },
  {
    name: "supprimer un article",
    key: "shopping.edit",
    call: (c, b) => c.delete(`${b}/items/${ID}`),
  },
  {
    name: "retirer les achetes",
    key: "shopping.edit",
    call: (c, b) => c.post(`${b}/checked/clear`),
  },
  {
    name: "restaurer des articles",
    key: "shopping.edit",
    call: (c, b) =>
      c.post(`${b}/items/restore`, {
        items: [
          {
            id: ID,
            sectionId: null,
            ingredientId: null,
            label: "lait",
            parts: [],
            sortOrder: 0,
            checkedAt: null,
            sources: [],
          },
        ],
      }),
  },
  {
    name: "apercu depuis le planning",
    key: "shopping.edit",
    call: (c, b) => c.post(`${b}/from-plan/preview`, { from: "2026-11-24", to: "2026-11-30" }),
  },
  {
    name: "ajouter depuis le planning",
    key: "shopping.edit",
    call: (c, b) =>
      c.post(`${b}/from-plan`, { from: "2026-11-24", to: "2026-11-30", ingredientIds: [ID] }),
  },
];

let fixture: GroupFixture;
const clients = new Map<string, Client>();

beforeAll(async () => {
  await db.module.updateMany({
    where: { code: { in: ["shopping", "meal-plan"] } },
    data: { status: "AVAILABLE" },
  });
  fixture = await groupFixture();
  await grantModule(fixture.spaceId, "shopping");
  await grantModule(fixture.spaceId, "meal-plan");
  for (const actor of ACTORS) clients.set(actor, await clientAs(actor, fixture, app));
  // Premiere ouverture faite : les sections existent.
  await (await loginAs(fixture.owner, app)).get(`/spaces/${fixture.spaceId}/shopping`);
});

describe("matrice B2 de la liste de courses", () => {
  for (const route of ROUTES) {
    for (const actor of ACTORS) {
      const allowed = allowedFor(
        actor,
        modulePermissionDefinition(SHOPPING_PERMISSIONS[route.key])
      );
      it(`${route.name} - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
        const client = clients.get(actor);
        if (!client) throw new Error("client expected");
        const res = await route.call(client, `/spaces/${fixture.spaceId}/shopping`);
        expectPermission(actor, allowed, res);
      });
    }
  }
});
