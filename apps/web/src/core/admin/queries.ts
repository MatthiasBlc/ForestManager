// Session admin (cookie distinct, D174). Jamais gardee hors ligne : la cle
// "admin" n'est pas dans la liste du cache persistant (lib/offline-cache.ts).
import { adminMeSchema } from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api, ApiRequestError } from "../../lib/api.ts";

/** Admin connecte (mot de passe et code valides), ou null. */
export const adminMeQuery = queryOptions({
  queryKey: ["admin", "me"],
  queryFn: async () => {
    try {
      return await api.get("/admin/me", adminMeSchema);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "ADMIN_002") return null;
      throw error;
    }
  },
  staleTime: 0,
});

/** Minutes restantes avant la fin de la session, arrondies au-dessus. */
export function minutesLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
}
