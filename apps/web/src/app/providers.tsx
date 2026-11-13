// Fournisseurs communs a l'application et aux tests (donnees, traductions).
// L'application garde une partie du cache sur l'appareil (`persist`, D35) ; les tests non.
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  type PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { i18n } from "../i18n/index.ts";

export function Providers({
  client,
  persist,
  children,
}: {
  client: QueryClient;
  persist?: Omit<PersistQueryClientOptions, "queryClient">;
  children: ReactNode;
}) {
  const content = <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
  return persist ? (
    <PersistQueryClientProvider client={client} persistOptions={persist}>
      {content}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={client}>{content}</QueryClientProvider>
  );
}
