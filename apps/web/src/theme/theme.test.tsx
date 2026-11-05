import type { Preferences } from "@fm/shared";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeController } from "./theme.tsx";
import { resolveTheme } from "./themes.ts";
import { useSpaceTint } from "./use-space-tint.ts";

const prefs = (over: Partial<Preferences> = {}): Preferences => ({
  ambiance: "BRAISE",
  colorMode: "SYSTEM",
  density: "COMFORTABLE",
  textScale: 100,
  locale: "fr",
  ...over,
});

// matchMedia pilotable : jsdom ne l'a pas.
let systemDark = false;
const listeners = new Set<() => void>();
beforeEach(() => {
  systemDark = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return query.includes("dark") && systemDark;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }),
  });
});
afterEach(() => {
  listeners.clear();
});

describe("resolveTheme", () => {
  it("suit le systeme en mode SYSTEM, sinon le mode choisi", () => {
    expect(resolveTheme(prefs({ ambiance: "SOUSBOIS" }), true)).toBe("sousbois-dark");
    expect(resolveTheme(prefs({ ambiance: "SOUSBOIS" }), false)).toBe("sousbois-light");
    expect(resolveTheme(prefs({ ambiance: "POTAGER", colorMode: "DARK" }), false)).toBe(
      "potager-dark"
    );
    expect(resolveTheme(prefs({ colorMode: "LIGHT" }), true)).toBe("braise-light");
    expect(resolveTheme(null, true)).toBe("braise-dark");
  });
});

describe("ThemeController", () => {
  it("pose theme, densite et taille du texte sur <html>", () => {
    render(
      <ThemeController
        preferences={prefs({ density: "COMPACT", textScale: 115, colorMode: "DARK" })}
      />
    );
    const html = document.documentElement;
    expect(html).toHaveAttribute("data-theme", "braise-dark");
    expect(html).toHaveAttribute("data-density", "compact");
    expect(html.style.getPropertyValue("--text-scale")).toBe("1.15");
  });

  it("suit un changement du reglage systeme", () => {
    render(<ThemeController preferences={prefs({ ambiance: "POTAGER" })} />);
    expect(document.documentElement).toHaveAttribute("data-theme", "potager-light");
    act(() => {
      systemDark = true;
      for (const fn of listeners) fn();
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "potager-dark");
  });

  it("avant connexion : Braise selon le systeme", () => {
    systemDark = true;
    render(<ThemeController preferences={null} />);
    expect(document.documentElement).toHaveAttribute("data-theme", "braise-dark");
    expect(document.documentElement).toHaveAttribute("data-density", "comfortable");
  });
});

describe("useSpaceTint", () => {
  function Space({ tint }: { tint: number | null }) {
    useSpaceTint(tint);
    return null;
  }
  it("pose la teinte de l'espace courant, la retire en sortant", () => {
    const { rerender, unmount } = render(<Space tint={3} />);
    expect(document.documentElement).toHaveAttribute("data-space", "3");
    rerender(<Space tint={5} />);
    expect(document.documentElement).toHaveAttribute("data-space", "5");
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-space");
  });
});
