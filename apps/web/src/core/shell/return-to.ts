// Retour d'une recette selon l'origine (D219) : chaque page connectee visitee hors
// des pages d'une recette est retenue (chemin et parametres) ; la fleche de retour
// de la recette y ramene, sous-pages (historique, cuisine, edition...) sautees.
// Retenue par onglet (sessionStorage) : survit au rechargement, un onglet neuf ou
// un lien partage revient a la liste des recettes.
import { useEffect } from "react";
import { useLocation } from "react-router";

const KEY = "fm:return-to";

/** Recette d'un espace et ses sous-pages, creation comprise (pas la liste ni les tags). */
const RECIPE_PAGE = /^\/s\/[^/]+\/recipes\/(?!tags\/?$|mine\/?$)[^/]+/;

export function isRecipePage(pathname: string): boolean {
  return RECIPE_PAGE.test(pathname);
}

export function rememberPage(path: string): void {
  if (isRecipePage(path.split("?")[0] ?? path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Stockage indisponible : le retour mene a la liste, sans consequence.
  }
}

/** Ou mene la fleche de retour d'une recette de cet espace. */
export function recipeBackTarget(spaceId: string): string {
  let saved: string | null = null;
  try {
    saved = sessionStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  // Chemin interne seulement (jamais une autre origine).
  if (saved?.startsWith("/") && !saved.startsWith("//")) return saved;
  return `/s/${spaceId}/recipes`;
}

/** Retient chaque page visitee (monte une fois dans les routes connectees). */
export function useRememberPage(): void {
  const { pathname, search } = useLocation();
  useEffect(() => {
    rememberPage(`${pathname}${search}`);
  }, [pathname, search]);
}
