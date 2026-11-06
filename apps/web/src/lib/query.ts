// Client TanStack Query de l'application.
import { QueryClient } from "@tanstack/react-query";

import { isNetworkError } from "./api.ts";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Pas de nouvel essai sur une erreur metier (4xx) : seulement sur le reseau.
        retry: (count, error) => count < 2 && isNetworkError(error),
      },
    },
  });
}
