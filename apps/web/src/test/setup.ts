// Setup des tests de composants [D157] : matchers jest-dom, MSW, nettoyage.
import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server.ts";

// Premier rendu d'un module charge a la demande : 1 s ne suffit pas quand les
// fichiers de tests tournent en parallele.
configure({ asyncUtilTimeout: 3000 });

// API absentes de jsdom dont Radix a besoin (positionnement, pointeur).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!("ResizeObserver" in globalThis)) {
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}
// Systeme en clair par defaut ; un test peut redefinir matchMedia.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});
const proto = Element.prototype as unknown as Record<string, unknown>;
for (const name of [
  "hasPointerCapture",
  "setPointerCapture",
  "releasePointerCapture",
  "scrollIntoView",
]) {
  if (typeof proto[name] !== "function") {
    proto[name] = name === "hasPointerCapture" ? () => false : () => undefined;
  }
}

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
