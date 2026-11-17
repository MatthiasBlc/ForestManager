// Controle des cles i18n [D78] : les ressources `fr` typent `t()`. Une cle
// absente des ressources est une erreur de `npm run typecheck` (bloquant en CI).
import "i18next";

import type { core } from "./fr/core.ts";
import type { errors } from "./fr/errors.ts";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "core";
    resources: { core: typeof core; errors: typeof errors };
  }
}
