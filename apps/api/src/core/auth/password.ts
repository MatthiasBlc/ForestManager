// Mots de passe : argon2id (la V1 utilisait bcrypt).
import argon2, { type HashOptions } from "argon2";

import { AppError } from "../http/errors.ts";
import { isWeakPassword } from "./weak-passwords.ts";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /** Hash factice : une connexion sur un compte inconnu coute autant qu'une vraie. */
  burn(password: string): Promise<void>;
}

/** Parametres OWASP en prod ; plus legers en test pour garder des tests rapides. */
export function createPasswordHasher(light = false): PasswordHasher {
  const options: HashOptions = light
    ? { type: argon2.argon2id, memoryCost: 1024, timeCost: 1, parallelism: 1 }
    : { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };
  let dummy: Promise<string> | undefined;
  return {
    hash: (password) => argon2.hash(password, options),
    verify: async (hash, password) => {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    },
    burn: async (password) => {
      dummy ??= argon2.hash("dummy-password-for-timing", options);
      await argon2.verify(await dummy, password).catch(() => false);
    },
  };
}

/** Refuse un mot de passe trop courant ou derive du compte (AUTH_009). */
export function assertStrongPassword(password: string, personal: readonly string[]): void {
  if (isWeakPassword(password, personal)) throw new AppError("AUTH_009");
}
