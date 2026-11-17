// Contexte des emplacements de barres du shell (voir page-chrome.tsx).
import { createContext } from "react";

export interface ChromeSlots {
  top: HTMLElement | null;
  bottom: HTMLElement | null;
  claim: (claimed: boolean) => void;
}

export const ChromeContext = createContext<ChromeSlots | null>(null);
