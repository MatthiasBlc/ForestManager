// Squelette web : page vide. Le design system, l'app shell et les ecrans arrivent en C2 [D144].
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Element #root introuvable");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
