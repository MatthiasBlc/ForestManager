// Erreurs de l'API -> erreurs de formulaire : un code connu va sur son champ,
// le reste devient l'erreur generale du formulaire (root).
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { errorMessage } from "../i18n/index.ts";
import { ApiRequestError } from "./api.ts";

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: Partial<Record<string, Path<T>>> = {}
): void {
  const message = errorMessage(error);
  const field = error instanceof ApiRequestError ? fields[error.code] : undefined;
  if (field) setError(field, { type: "server", message });
  else setError("root", { type: "server", message });
}

/** Cible de redirection sure (chemin interne seulement). */
export function safeNext(next: string | null, fallback = "/"): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
