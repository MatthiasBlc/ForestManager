// Point d'entree du web : styles, fournisseurs, routeur.
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "./app/App.tsx";
import { Providers } from "./app/providers.tsx";
import { offlinePersistOptions } from "./lib/offline-cache.ts";
import { createQueryClient } from "./lib/query.ts";

const root = document.getElementById("root");
if (!root) throw new Error("Element #root introuvable");

const client = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <Providers client={client} persist={offlinePersistOptions(client)}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Providers>
  </StrictMode>
);
