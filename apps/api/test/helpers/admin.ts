// Comptes admin de test : 2FA deja configuree par defaut, code TOTP calcule ici.
import { TEST_PASSWORD, buildUser } from "@fm/test-utils";
import { generateSecret, generateSync } from "otplib";

import { createClient, createTestApp, type Client } from "./app.ts";
import { db } from "./db.ts";
import { testPasswordHash } from "./factories.ts";

export interface TestAdmin {
  id: string;
  username: string;
  email: string;
  password: string;
  totpSecret: string;
}

export async function createAdmin(options: { totpEnabled?: boolean } = {}): Promise<TestAdmin> {
  const { username, email } = buildUser();
  const admin = await db.adminUser.create({
    data: {
      username: `adm_${username}`.slice(0, 30),
      email: `admin.${email}`,
      password: testPasswordHash(),
      totpSecret: generateSecret(),
      totpEnabled: options.totpEnabled ?? true,
    },
  });
  return { ...admin, password: TEST_PASSWORD };
}

/** Code TOTP courant du compte. */
export function totpFor(admin: Pick<TestAdmin, "totpSecret">): string {
  return generateSync({ secret: admin.totpSecret });
}

/** Etape mot de passe de la connexion admin. */
export function adminLogin(client: Client, admin: Pick<TestAdmin, "username" | "password">) {
  return client.post("/admin/auth/login", { identifier: admin.username, password: admin.password });
}

/** Client avec une session admin complete (mot de passe puis code). */
export async function loginAdmin(admin: TestAdmin, app = createTestApp()): Promise<Client> {
  const client = await createClient(app);
  await adminLogin(client, admin);
  const res = await client.post("/admin/auth/totp", { code: totpFor(admin) });
  if (res.status !== 200)
    throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return client;
}
