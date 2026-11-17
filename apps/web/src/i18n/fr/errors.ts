// Messages des codes d'erreur (namespace `errors`) : ceux de l'API, repris du
// partage [D87], et ceux que le client produit seul (`ClientErrorCode`).
import { ERROR_CODES, ERRORS, type ErrorCode } from "@fm/shared";

import type { ClientErrorCode } from "../../lib/api.ts";

const client: Record<ClientErrorCode, string> = {
  NETWORK: "Connexion impossible. Vérifie ton réseau.",
  OFFLINE: "Tu es hors ligne : réessaie quand le réseau sera revenu.",
  CONTRACT: "Réponse inattendue du serveur. Recharge la page.",
};

export const errors = {
  ...(Object.fromEntries(ERROR_CODES.map((code) => [code, ERRORS[code].message])) as Record<
    ErrorCode,
    string
  >),
  ...client,
};
