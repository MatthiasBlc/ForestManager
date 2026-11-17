// Emplacements de barres tenus par le shell (voir page-chrome.tsx).
import { useState, type ReactElement } from "react";

import type { ChromeSlots } from "./page-chrome-context.ts";

/** Etat du shell : emplacements et presence d'une page qui les occupe. */
export function useChromeSlots(): {
  claimed: boolean;
  value: ChromeSlots;
  topSlot: ReactElement;
  bottomSlot: ReactElement;
} {
  const [top, setTop] = useState<HTMLElement | null>(null);
  const [bottom, setBottom] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const [claim] = useState(() => (claimed: boolean) => {
    setClaims((count) => count + (claimed ? 1 : -1));
  });
  return {
    claimed: claims > 0,
    value: { top, bottom, claim },
    /** `display: contents` : la barre rendue dedans se place dans la grille du shell. */
    topSlot: <div className="contents" ref={setTop} />,
    bottomSlot: <div className="contents" ref={setBottom} />,
  };
}
