// Themes du design system : trois ambiances x clair / sombre [D32].
import type { Preferences } from "@fm/shared";

export type Ambiance = Preferences["ambiance"];

export const THEMES = [
  "braise-dark",
  "braise-light",
  "sousbois-light",
  "sousbois-dark",
  "potager-light",
  "potager-dark",
] as const;
export type Theme = (typeof THEMES)[number];

export const AMBIANCES = {
  BRAISE: {
    key: "braise",
    label: "Braise",
    tints: ["Braise", "Nuit", "Tison", "Flamme", "Cendre"],
  },
  SOUSBOIS: {
    key: "sousbois",
    label: "Sous-bois",
    tints: ["Sapin", "Lichen", "Baie", "Myrtille", "Mousse"],
  },
  POTAGER: {
    key: "potager",
    label: "Potager",
    tints: ["Tomate", "Courge", "Aubergine", "Basilic", "Betterave"],
  },
} as const satisfies Record<Ambiance, { key: string; label: string; tints: readonly string[] }>;

/** Apercu d'un theme (fond puis trois teintes), releve dans tokens.css. */
export const THEME_SWATCHES: Record<Theme, readonly string[]> = {
  "braise-dark": ["#16181b", "#e8913a", "#7d9be0", "#e2716c"],
  "braise-light": ["#f5f3ef", "#b45f19", "#3f5fa8", "#b53a36"],
  "sousbois-light": ["#f4f6f1", "#2e6b47", "#5f7a23", "#9c3550"],
  "sousbois-dark": ["#0f1712", "#6fbf8e", "#b2cc6b", "#e07a95"],
  "potager-light": ["#f7f7f4", "#c93c26", "#a8650f", "#5b3f8c"],
  "potager-dark": ["#15151a", "#f0745f", "#f0b54e", "#a58bd6"],
};

export function themeLabel(theme: Theme): string {
  const [key, mode] = theme.split("-");
  const ambiance = Object.values(AMBIANCES).find((a) => a.key === key);
  return `${ambiance?.label ?? key} ${mode === "dark" ? "sombre" : "clair"}`;
}

export function themeOf(ambiance: Ambiance, dark: boolean): Theme {
  return `${AMBIANCES[ambiance].key}-${dark ? "dark" : "light"}`;
}

export function tintNames(theme: Theme): readonly string[] {
  const key = theme.split("-")[0];
  return Object.values(AMBIANCES).find((a) => a.key === key)?.tints ?? [];
}
