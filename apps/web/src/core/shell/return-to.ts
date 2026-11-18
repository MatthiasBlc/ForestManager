// Retour d'une recette selon l'origine (D219) : chaque page connectee visitee hors
// des pages d'une recette est retenue (chemin et parametres) ; la fleche de retour
// de la recette y ramene, sous-pages (historique, cuisine, edition...) sautees.
// Retenue par onglet (sessionStorage) : survit au rechargement, un onglet neuf ou
// un lien partage revient a la liste des recettes.
// La fleche remonte l'historique jusqu'a l'origine quand elle y est (position
// `idx` posee par le routeur) : le geste retour d'Android part alors d'avant
// l'origine, au lieu de revenir sur la recette.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const KEY = "fm:return-to";
const IDX_KEY = "fm:return-to-idx";

/** Position de la page courante dans l'historique de l'onglet, si le routeur la pose. */
function historyIndex(): number | null {
  const state: unknown = window.history.state;
  if (state && typeof state === "object" && "idx" in state && typeof state.idx === "number") {
    return state.idx;
  }
  return null;
}

/** Recette d'un espace et ses sous-pages, creation comprise (pas la liste ni les tags). */
const RECIPE_PAGE = /^\/s\/[^/]+\/recipes\/(?!tags\/?$|mine\/?$)[^/]+/;

export function isRecipePage(pathname: string): boolean {
  return RECIPE_PAGE.test(pathname);
}

export function rememberPage(path: string): void {
  if (isRecipePage(path.split("?")[0] ?? path)) return;
  const idx = historyIndex();
  try {
    sessionStorage.setItem(KEY, path);
    if (idx === null) sessionStorage.removeItem(IDX_KEY);
    else sessionStorage.setItem(IDX_KEY, String(idx));
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

/**
 * Mouvement de la fleche : remonter jusqu'a l'origine si elle est plus haut dans
 * l'historique de l'onglet, sinon la poser a la place de la page courante.
 */
export function recipeBackMove(spaceId: string): { delta: number } | { to: string } {
  const to = recipeBackTarget(spaceId);
  let saved: number | null = null;
  try {
    const raw = sessionStorage.getItem(IDX_KEY);
    saved = raw === null ? null : Number(raw);
  } catch {
    saved = null;
  }
  const current = historyIndex();
  if (saved !== null && Number.isInteger(saved) && current !== null && saved < current) {
    return { delta: saved - current };
  }
  return { to };
}

/** Retour d'une recette vers son origine (fleche, suppression, annulation). */
export function useRecipeBack(spaceId: string): () => void {
  const navigate = useNavigate();
  return () => {
    const move = recipeBackMove(spaceId);
    if ("delta" in move) void navigate(move.delta);
    else void navigate(move.to, { replace: true });
  };
}

/** Retient chaque page visitee (monte une fois dans les routes connectees). */
export function useRememberPage(): void {
  const { pathname, search } = useLocation();
  useEffect(() => {
    rememberPage(`${pathname}${search}`);
  }, [pathname, search]);
}
