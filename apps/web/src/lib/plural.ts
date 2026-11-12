// Accord en nombre des textes de l'interface : "1 membre", "3 membres".

/** Nombre suivi du nom accorde ; 0 et 1 au singulier (regle francaise). */
export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}
