// Dernier espace et derniere entree visites (D60), propres a l'appareil : simple confort, jamais critique.
const KEY = "fm:lastSpace";
const SECTION_KEY = "fm:lastSection";

export function readLastSpace(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastSpace(spaceId: string): void {
  try {
    localStorage.setItem(KEY, spaceId);
  } catch {
    // Stockage indisponible (navigation privee) : sans consequence.
  }
}

/** Derniere entree de navigation visitee dans cet espace ("recipes", "members"...). */
export function readLastSection(spaceId: string): string | null {
  try {
    const raw = localStorage.getItem(SECTION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "spaceId" in value &&
      "path" in value &&
      value.spaceId === spaceId &&
      typeof value.path === "string"
    ) {
      return value.path;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLastSection(spaceId: string, path: string): void {
  try {
    localStorage.setItem(SECTION_KEY, JSON.stringify({ spaceId, path }));
  } catch {
    // Stockage indisponible : sans consequence.
  }
}
