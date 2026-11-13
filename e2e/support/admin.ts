// Super admin des parcours : code TOTP calcule ici (RFC 6238, SHA-1, 6 chiffres,
// 30 s : les reglages par defaut d'otplib cote API), connexion par l'API.
import { createHmac } from "node:crypto";

import type { Page } from "@playwright/test";

import { apiCall, expect } from "./test.ts";

/** Compte rendu par le scenario `admin`. */
export interface AdminAccount {
  id: string;
  username: string;
  password: string;
  totpSecret: string;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(text: string): Buffer {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error("invalid base32 secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
}

/** Code TOTP courant du compte. */
export function totpFor(admin: Pick<AdminAccount, "totpSecret">, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", base32Decode(admin.totpSecret)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** Session admin complete posee par l'API (mot de passe puis code) : le parcours 13 passe par les ecrans. */
export async function loginAdmin(page: Page, admin: AdminAccount): Promise<void> {
  const password = await apiCall(page, "POST", "/admin/auth/login", {
    identifier: admin.username,
    password: admin.password,
  });
  expect(password.status(), "admin login (password)").toBe(200);
  const totp = await apiCall(page, "POST", "/admin/auth/totp", { code: totpFor(admin) });
  expect(totp.status(), "admin login (totp)").toBe(200);
}
