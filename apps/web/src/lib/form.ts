// Resolver react-hook-form pour les schemas Zod partages (remplace
// @hookform/resolvers, dont les dependances optionnelles sont en conflit).
import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import { z } from "zod";

// Messages de validation en francais.
z.config(z.locales.fr());

function setError(target: Record<string, unknown>, path: PropertyKey[], error: object): void {
  let node = target;
  for (const [index, key] of path.entries()) {
    const name = String(key);
    if (index === path.length - 1) {
      node[name] ??= error; // la premiere erreur d'un champ gagne
      return;
    }
    node[name] ??= {};
    node = node[name] as Record<string, unknown>;
  }
}

export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S
): Resolver<z.input<S>, unknown, z.output<S>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path : ["root"];
      setError(errors, path, { type: issue.code, message: issue.message });
    }
    return { values: {}, errors: errors as FieldErrors<z.input<S>> };
  };
}
