// Requetes du module Liste de courses. Toutes sous ["spaces", id, "shopping"] : le
// temps reel relit ce prefixe a chaque ecriture d'un membre (D188).
import { shoppingListSchema, shoppingSettingsSchema } from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const shoppingKey = (spaceId: string) => ["spaces", spaceId, "shopping"] as const;

export function listQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...shoppingKey(spaceId), "list"],
    queryFn: () => api.get(`/spaces/${spaceId}/shopping`, shoppingListSchema),
  });
}

export function settingsQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...shoppingKey(spaceId), "settings"],
    queryFn: () => api.get(`/spaces/${spaceId}/shopping/settings`, shoppingSettingsSchema),
  });
}
