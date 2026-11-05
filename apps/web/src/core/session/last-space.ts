// Dernier espace visite (D60), propre a l'appareil : simple confort, jamais critique.
const KEY = "fm:lastSpace";

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
