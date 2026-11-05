// i18next [D34, D73] : francais seul en V2.0. Namespace `core` (socle) et
// `errors` (messages des codes de l'API, repris du partage).
import { ERROR_CODES, ERRORS } from "@fm/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ApiRequestError } from "../lib/api.ts";
import { core } from "./fr/core.ts";

const errors: Record<string, string> = {
  ...Object.fromEntries(ERROR_CODES.map((code) => [code, ERRORS[code].message])),
  NETWORK: "Connexion impossible. Vérifie ton réseau.",
  OFFLINE: "Tu es hors ligne : réessaie quand le réseau sera revenu.",
  CONTRACT: "Réponse inattendue du serveur. Recharge la page.",
};

void i18n.use(initReactI18next).init({
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "core",
  ns: ["core", "errors"],
  resources: { fr: { core, errors } },
  interpolation: { escapeValue: false }, // React echappe deja
  initAsync: false,
});

/** Message a montrer pour une erreur quelconque (code de l'API traduit si connu). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return i18n.exists(error.code, { ns: "errors" })
      ? i18n.t(error.code, { ns: "errors" })
      : error.message;
  }
  return ERRORS.COMMON_001.message;
}

export { i18n };
