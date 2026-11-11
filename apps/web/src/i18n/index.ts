// i18next [D34, D73] : francais seul en V2.0. Namespace `core` (socle) et
// `errors` (messages des codes de l'API, repris du partage).
import { ERRORS } from "@fm/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ApiRequestError } from "../lib/api.ts";
import { core } from "./fr/core.ts";
import { errors } from "./fr/errors.ts";

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
    // Code venu du serveur : connu ou non du client, d'ou le test avant `t()`.
    const code = error.code as keyof typeof errors;
    return i18n.exists(code, { ns: "errors" }) ? i18n.t(code, { ns: "errors" }) : error.message;
  }
  return ERRORS.COMMON_001.message;
}

export { i18n };
