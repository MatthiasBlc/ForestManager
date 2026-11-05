// Applique les preferences d'affichage sur <html> [D32, D115] : theme
// (ambiance + clair / sombre, ou celui du systeme), densite, taille du texte.
import type { Preferences } from "@fm/shared";
import { useEffect } from "react";

import { useSystemDark } from "./system-dark.ts";
import { resolveTheme } from "./themes.ts";

export function ThemeController({ preferences }: { preferences: Preferences | null }) {
  const systemDark = useSystemDark();
  const theme = resolveTheme(preferences, systemDark);
  const density = (preferences?.density ?? "COMFORTABLE").toLowerCase();
  const scale = (preferences?.textScale ?? 100) / 100;

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.dataset.density = density;
    html.style.setProperty("--text-scale", String(scale));
    // Couleur de la barre du navigateur (PWA) : fond du theme.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        getComputedStyle(html).getPropertyValue("--bg").trim() || "#16181b"
      );
  }, [theme, density, scale]);

  return null;
}
