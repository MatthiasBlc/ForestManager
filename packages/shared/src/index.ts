// Contrat partage entre l'API et le web : aucune dependance a Node ni au DOM.
// Sous-chemins disponibles : @fm/shared/errors, /permissions, /modules, /schemas.

/** Prefixe commun de toutes les routes de l'API. */
export const API_PREFIX = "/api/v1";

export * from "./errors/index.ts";
export * from "./permissions/index.ts";
export * from "./modules/index.ts";
export * from "./schemas/index.ts";
export * from "./recipes/index.ts";
export * from "./units/index.ts";
