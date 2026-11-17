// Donnees du compte gardees dans le navigateur (dernier espace, recettes recentes,
// brouillons) : toutes sous le prefixe "fm:". La deconnexion les efface (D10).
const PREFIX = "fm:";

export function clearAccountStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Stockage indisponible : rien a effacer.
  }
}
