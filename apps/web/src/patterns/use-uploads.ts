// Envoi de photos disponible (stockage configure cote API) [D167].
import { useQuery } from "@tanstack/react-query";

import { configQuery } from "../core/session/queries.ts";

export function useUploadsEnabled(): boolean {
  return useQuery(configQuery).data?.features.uploads ?? false;
}
