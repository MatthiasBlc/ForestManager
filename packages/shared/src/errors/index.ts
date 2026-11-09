// Codes erreur centralises [D72]. Jamais de string literal d'erreur ailleurs.
// Chaque code porte son statut HTTP, un message par defaut (francais, vu par
// l'utilisateur, donc accentue [D87]) et une cle i18n stable pour le front.
//
// Regle de non-enumeration : un espace dont on n'est pas membre repond
// SPACE_001 (404), comme un espace qui n'existe pas.

import { z } from "zod";

interface ErrorDefinition {
  readonly status: number;
  readonly message: string;
}

const DEFINITIONS = {
  // --- Commun ---
  COMMON_001: { status: 500, message: "Une erreur inattendue est survenue." },
  COMMON_002: { status: 403, message: "Jeton CSRF absent ou invalide." },
  COMMON_003: { status: 404, message: "Ressource introuvable." },
  COMMON_004: { status: 429, message: "Trop de requêtes, réessayez dans un moment." },
  COMMON_005: { status: 413, message: "La requête est trop volumineuse." },
  COMMON_006: { status: 409, message: "Cette action a déjà été traitée." },

  // --- Validation ---
  VALIDATION_001: { status: 400, message: "Les données envoyées sont invalides." },

  // --- Authentification et compte ---
  AUTH_001: { status: 401, message: "Vous devez être connecté." },
  AUTH_002: { status: 401, message: "Identifiants incorrects." },
  AUTH_003: { status: 409, message: "Ce nom d'utilisateur est déjà pris." },
  AUTH_004: { status: 409, message: "Cette adresse email est déjà utilisée." },
  AUTH_005: { status: 403, message: "Mot de passe actuel incorrect." },
  AUTH_006: { status: 429, message: "Trop de tentatives, réessayez plus tard." },
  AUTH_007: { status: 404, message: "L'envoi d'emails n'est pas configuré." },
  AUTH_008: { status: 400, message: "Ce lien est invalide ou a expiré." },
  AUTH_009: { status: 400, message: "Ce mot de passe est trop courant, choisissez-en un autre." },
  AUTH_010: { status: 409, message: "Vous êtes déjà connecté." },
  AUTH_011: { status: 403, message: "Vous devez choisir un nouveau mot de passe." },
  AUTH_012: { status: 404, message: "Utilisateur introuvable." },
  AUTH_013: { status: 409, message: "Cette adresse email est déjà vérifiée." },
  AUTH_014: {
    status: 409,
    message:
      "Ce mot de passe temporaire n'est plus valable. Demandez-en un nouveau à l'administrateur.",
  },

  // --- Espaces, membres, invitations ---
  SPACE_001: { status: 404, message: "Espace introuvable." },
  SPACE_002: { status: 403, message: "Votre rôle ne permet pas cette action." },
  SPACE_003: { status: 409, message: "Action impossible dans un espace perso." },
  SPACE_004: {
    status: 409,
    message: "Transférez la propriété de l'espace avant de le quitter.",
  },
  SPACE_005: {
    status: 409,
    message: "Vous êtes le dernier membre : quitter supprimera l'espace.",
  },
  SPACE_006: { status: 409, message: "Cette personne est déjà membre de l'espace." },
  SPACE_007: { status: 404, message: "Membre introuvable." },
  SPACE_008: { status: 409, message: "Ce changement de rôle n'est pas possible." },
  SPACE_009: { status: 409, message: "Vous possédez déjà le nombre maximal d'espaces." },
  SPACE_010: { status: 409, message: "Un transfert de propriété est déjà en attente." },
  SPACE_011: { status: 404, message: "Transfert de propriété introuvable." },
  SPACE_012: { status: 404, message: "Invitation introuvable." },
  SPACE_013: { status: 409, message: "Une invitation est déjà en attente pour cette personne." },
  SPACE_014: { status: 410, message: "Ce lien d'invitation n'est plus valable." },
  SPACE_015: {
    status: 403,
    message: "Vous ne pouvez revenir dans cet espace que sur invitation directe.",
  },
  SPACE_016: { status: 409, message: "Cet espace n'est pas supprimé." },
  SPACE_017: { status: 410, message: "Le délai de restauration de cet espace est dépassé." },
  SPACE_018: { status: 404, message: "Lien d'invitation introuvable." },
  SPACE_019: { status: 409, message: "Vous ne pouvez pas faire cette action sur vous-même." },

  // --- Stockage des photos et avatars [D167] ---
  STORAGE_001: { status: 503, message: "L'envoi de photos n'est pas disponible." },
  STORAGE_002: { status: 404, message: "Photo introuvable : envoie-la de nouveau." },
  STORAGE_003: { status: 400, message: "Ce fichier n'est pas une image valide." },

  // --- Modules ---
  MODULE_001: { status: 403, message: "Ce module n'est pas actif dans cet espace." },
  MODULE_002: { status: 404, message: "Module introuvable." },
  MODULE_003: { status: 409, message: "Ce module n'est pas disponible." },
  MODULE_004: { status: 409, message: "Une demande d'accès est déjà en attente." },
  MODULE_005: { status: 409, message: "Ce module n'est pas accordé à cet espace." },
  MODULE_006: { status: 409, message: "Ce module ne peut pas être désactivé." },
  MODULE_007: { status: 404, message: "Demande d'accès introuvable." },
  MODULE_008: { status: 409, message: "Ce module est déjà accordé à cet espace." },

  // --- Recettes et referentiels ---
  RECIPE_001: { status: 404, message: "Recette introuvable." },
  RECIPE_002: { status: 409, message: "Un tag porte déjà ce nom dans cet espace." },
  RECIPE_003: { status: 404, message: "Tag introuvable." },
  RECIPE_004: {
    status: 409,
    message: "La recette a été modifiée entre-temps : rechargez-la avant d'enregistrer.",
  },
  RECIPE_005: { status: 409, message: "Cette révision est déjà la version actuelle." },
  RECIPE_006: { status: 404, message: "Révision introuvable." },
  RECIPE_007: { status: 409, message: "Une recette ne peut pas se contenir elle-même." },
  RECIPE_008: {
    status: 409,
    message: "Trois niveaux de recettes liées au maximum (plat, sauce, fond).",
  },
  RECIPE_009: { status: 409, message: "Cette recette est déjà visible dans cet espace." },
  RECIPE_010: { status: 404, message: "Demande de partage introuvable ou déjà traitée." },
  RECIPE_011: { status: 404, message: "Cette recette n'est pas une adaptation." },
  RECIPE_012: {
    status: 403,
    message: "Tu es l'auteur de cette recette : modifie-la directement.",
  },
  RECIPE_013: { status: 409, message: "Tu as déjà une suggestion en attente sur cette recette." },
  RECIPE_014: { status: 404, message: "Suggestion introuvable ou déjà traitée." },
  RECIPE_015: { status: 400, message: "Ce lien ne peut pas être importé." },
  RECIPE_016: { status: 422, message: "Cette page est injoignable ou trop lourde." },
  RECIPE_017: { status: 422, message: "Aucune recette trouvée sur cette page." },

  // --- Planning ---
  MEAL_001: { status: 409, message: "Ce repas n'est pas planifié dans cet espace." },
  MEAL_002: { status: 404, message: "Idée de repas introuvable." },

  // --- Administration de la plateforme ---
  ADMIN_001: { status: 401, message: "Identifiants incorrects." },
  ADMIN_002: { status: 401, message: "Connexion administrateur requise." },
  ADMIN_003: { status: 401, message: "Code de vérification incorrect." },
  ADMIN_004: {
    status: 429,
    message: "Trop de codes incorrects. Recommencez la connexion.",
  },
  ADMIN_005: { status: 409, message: "Ce compte administrateur existe déjà." },
  ADMIN_006: { status: 404, message: "Demande introuvable ou déjà traitée." },
  ADMIN_007: {
    status: 409,
    message: "Le module fourni à chaque espace ne peut pas être modifié ni retiré.",
  },
  ADMIN_008: { status: 404, message: "Élément introuvable." },
  ADMIN_009: { status: 409, message: "Ce nom ou ce code est déjà pris." },
  ADMIN_010: {
    status: 409,
    message: "Fusion impossible : la cible doit être un autre élément, encore actif.",
  },
  ADMIN_011: {
    status: 422,
    message: "Rayon ou unité invalide (le poids par unité ne vaut que pour les pièces).",
  },
  ADMIN_012: { status: 422, message: "L'ordre doit contenir chaque rayon une seule fois." },
  ADMIN_013: {
    status: 403,
    message: "Accès de modération requis : ouvrez-le avec un motif (30 minutes, lecture seule).",
  },
  ADMIN_014: { status: 409, message: "Cette recette n'est pas partagée dans cet espace." },
  ADMIN_015: {
    status: 409,
    message: "Cet espace n'est pas en suppression ou ne peut plus être restauré.",
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof DEFINITIONS;

export interface ErrorInfo extends ErrorDefinition {
  readonly code: ErrorCode;
  /** Cle de traduction cote front : `errors.<CODE>`. */
  readonly i18nKey: `errors.${ErrorCode}`;
}

export const ERROR_CODES = Object.keys(DEFINITIONS) as ErrorCode[];

export const ERRORS = Object.fromEntries(
  ERROR_CODES.map((code) => [
    code,
    { code, ...DEFINITIONS[code], i18nKey: `errors.${code}` } satisfies ErrorInfo,
  ])
) as { readonly [C in ErrorCode]: ErrorInfo & { readonly code: C } };

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(DEFINITIONS, value);
}

/** Corps de reponse d'erreur unique de l'API [D72]. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function errorBody(code: ErrorCode, details?: unknown): ApiError {
  const { message } = ERRORS[code];
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}
