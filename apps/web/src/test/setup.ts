// Setup des tests de composants [D157] : matchers jest-dom, MSW, nettoyage.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server.ts";

// Une requete sans handler est une erreur de test, pas un appel reseau reel.
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => {
  server.close();
});
