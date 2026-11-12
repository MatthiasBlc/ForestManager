// Donnees de test partagees [D79] : constructeurs purs (sans base), reutilises
// par les tests d'integration de l'API (qui les enregistrent) et par l'E2E.

/** UUID valide qui ne correspond a aucune ligne : cas "not found" des tests. */
export const NOT_FOUND_UUID = "00000000-0000-4000-8000-000000000000";

/** Mot de passe de tous les comptes de test (respecte la politique). */
export const TEST_PASSWORD = "test-password-123";

let counter = 0;

/** Suffixe unique dans le processus : usernames et emails sans collision. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export interface UserData {
  email: string;
  username: string;
  password: string;
}

export function buildUser(overrides: Partial<UserData> = {}): UserData {
  const username = overrides.username ?? unique("user_");
  return {
    email: `${username.toLowerCase()}@test.local`,
    password: TEST_PASSWORD,
    ...overrides,
    username,
  };
}

export interface SpaceData {
  name: string;
  description: string | null;
  tintIndex: number;
}

export function buildSpace(overrides: Partial<SpaceData> = {}): SpaceData {
  return { name: unique("Espace "), description: null, tintIndex: 1, ...overrides };
}
