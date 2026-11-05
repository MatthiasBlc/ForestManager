// Noms et descriptions des modules : textes de l'interface (le module est du code), pas des donnees.
export const MODULE_INFO: Record<string, { name: string; description: string }> = {
  recipes: {
    name: "Recettes",
    description: "Les recettes de l'espace, leurs partages et adaptations.",
  },
  "meal-plan": {
    name: "Planning des repas",
    description: "Les repas de la semaine, à la main ou générés selon vos règles.",
  },
  shopping: {
    name: "Liste de courses",
    description: "La liste tirée du planning, rangée par rayon.",
  },
};

export function moduleInfo(code: string): { name: string; description: string } {
  return MODULE_INFO[code] ?? { name: code, description: "" };
}
