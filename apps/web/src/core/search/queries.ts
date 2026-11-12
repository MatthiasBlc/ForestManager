// Requete de la recherche globale (GET /search) [D191].
import { searchResponseSchema } from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export function searchQuery(q: string, spaceId: string) {
  const params = new URLSearchParams({ q, spaceId });
  return queryOptions({
    queryKey: ["search", spaceId, q],
    queryFn: () => api.get(`/search?${params.toString()}`, searchResponseSchema),
    staleTime: 30 * 1000,
  });
}
