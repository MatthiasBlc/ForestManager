// Client TanStack Query de l'application.
import { onlineManager, QueryClient } from "@tanstack/react-query";

import { isNetworkError } from "./api.ts";

export function createQueryClient(): QueryClient {
  // TanStack ne suit que les evenements online/offline et se croit en ligne au
  // demarrage : lancee sans reseau, l'application relancerait les donnees
  // relues de l'appareil et finirait en erreur (D35).
  onlineManager.setOnline(navigator.onLine);
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
