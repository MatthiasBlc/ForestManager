// Ctrl K (Cmd K sur Mac) ouvre la recherche globale partout dans le shell [D119].
import { useEffect } from "react";

export function usePaletteShortcut(open: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}
