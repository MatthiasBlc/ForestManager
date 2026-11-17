import { useEffect } from "react";

/**
 * Teinte de l'espace courant sur <html data-space> : toute l'interface, y
 * compris les feuilles et menus rendus en portail, prend l'accent de l'espace.
 */
export function useSpaceTint(tint: number | null): void {
  useEffect(() => {
    const html = document.documentElement;
    if (tint === null) {
      delete html.dataset.space;
      return;
    }
    html.dataset.space = String(tint);
    return () => {
      delete html.dataset.space;
    };
  }, [tint]);
}
