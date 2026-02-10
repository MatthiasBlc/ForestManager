// Validation constants et utilitaires partages

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 8;

export const COMMUNITY_VALIDATION = {
  NAME_MIN: 3,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 1000,
};

/**
 * Normalise une liste de noms (tags ou ingredients) :
 * trim, lowercase, deduplique, filtre les vides.
 */
export function normalizeNames(items: string[]): string[] {
  return [
    ...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)),
  ];
}

/**
 * Valide qu'une URL est bien http ou https.
 * Retourne true si null/undefined (champ optionnel).
 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
