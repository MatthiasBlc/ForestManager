// Point d'entree du web : styles, fournisseurs, routeur.
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "./app/App.tsx";
import { startErrorTracking } from "./app/error-tracking.ts";
import { Providers } from "./app/providers.tsx";
import { offlinePersistOptions } from "./lib/offline-cache.ts";
import { createQueryClient } from "./lib/query.ts";

const root = document.getElementById("root");
if (!root) throw new Error("Element #root introuvable");

const client = createQueryClient();
// Suivi d'erreurs : SDK charge a la demande si l'API l'annonce [D196].
void startErrorTracking(client);

createRoot(root).render(
  <StrictMode>
    <Providers client={client} persist={offlinePersistOptions(client)}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Providers>
  </StrictMode>
);
