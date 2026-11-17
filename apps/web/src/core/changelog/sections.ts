// Changelog (C6.6) : libelles des sections et date de publication, partages par
// A10 (admin) et la page Nouveautes.
import { RELEASE_SECTIONS, type ReleaseContent, type ReleaseSection } from "@fm/shared";

export const SECTION_LABELS: Readonly<Record<ReleaseSection, string>> = {
  features: "Nouveautés",
  improvements: "Améliorations",
  fixes: "Corrections",
};

/** Sections dans l'ordre d'affichage, avec leurs items. */
export function sectionsOf(content: ReleaseContent) {
  return RELEASE_SECTIONS.map((key) => ({ key, label: SECTION_LABELS[key], items: content[key] }));
}

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "3 novembre 2026" */
export function releaseDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}
