// Validation constants et utilitaires partages
// Note: Les type guards (assertString, etc.) ont ete supprimes car Zod gere maintenant la validation

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 8;

// Max length constants
export const MAX_USERNAME_LENGTH = 30;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NAME_LENGTH = 100;
export const MAX_REASON_LENGTH = 500;
export const MAX_URL_LENGTH = 2048;
export const MAX_FILTER_ITEMS = 20;
export const MAX_TAGS_PER_RECIPE = 10;
export const MAX_SEARCH_LENGTH = 200;

export const COMMUNITY_VALIDATION = {
  NAME_MIN: 3,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 1000,
};

// --- ValidationError ---
// Garde pour compatibilite avec errorHandler.ts

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code: string;

  constructor(message: string, code = "VALIDATION_001") {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ValidationError";
  }
}

/**
 * Normalise une liste de noms (tags ou ingredients) :
 * trim, lowercase, deduplique, filtre les vides.
 */
export function normalizeNames(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean))];
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

// --- Recipe validators (gardes pour les tests unitaires) ---

export function validateServings(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100;
}

export function validateTime(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10000;
}

export interface StepInput {
  instruction: string;
}

export function validateSteps(steps: unknown): steps is StepInput[] {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  return steps.every(
    (s) =>
      s &&
      typeof s === "object" &&
      "instruction" in s &&
      typeof s.instruction === "string" &&
      s.instruction.trim().length > 0 &&
      s.instruction.trim().length <= 5000
  );
}
