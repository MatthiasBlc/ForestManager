// Requetes du socle partagees par le shell et les ecrans.
import {
  appConfigSchema,
  listSchema,
  meSchema,
  spaceDetailSchema,
  spaceSummarySchema,
} from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api, ApiRequestError } from "../../lib/api.ts";

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: () => api.get("/config", appConfigSchema),
  staleTime: Infinity,
});

/** Utilisateur connecte, ou null sans session. */
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    try {
      return await api.get("/me", meSchema);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "AUTH_001") return null;
      throw error;
    }
  },
});

export const spacesQuery = queryOptions({
  queryKey: ["spaces"],
  queryFn: async () => (await api.get("/spaces", listSchema(spaceSummarySchema))).data,
});

export function spaceQuery(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", spaceId],
    queryFn: () => api.get(`/spaces/${spaceId}`, spaceDetailSchema),
  });
}
