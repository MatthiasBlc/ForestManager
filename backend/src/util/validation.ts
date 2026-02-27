import createHttpError from "http-errors";

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

// --- Tag validation ---

/**
 * Valide et normalise un nom de tag : trim, lowercase, longueur 2-50.
 * Retourne le nom normalise ou throw createHttpError.
 */
export function validateTagName(name: unknown, errorPrefix = "TAG_001"): string {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createHttpError(400, `${errorPrefix}: Tag name is required`);
  }

  const normalized = name.trim().toLowerCase();

  if (normalized.length < 2 || normalized.length > 50) {
    throw createHttpError(400, `${errorPrefix}: Tag name must be between 2 and 50 characters`);
  }

  return normalized;
}

// --- Recipe Rework v2 validators ---

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
