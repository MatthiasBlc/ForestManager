// Client TanStack Query : etat du reseau lu au demarrage (D35). Sans cela,
// l'application lancee hors ligne se croit en ligne, relance les donnees relues
// de l'appareil et finit en erreur.
import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { createQueryClient } from "./query.ts";

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
}

afterEach(() => {
  setNavigatorOnline(true);
  onlineManager.setOnline(true);
});

describe("createQueryClient", () => {
  it("lance hors ligne : hors ligne, les requetes attendront le reseau", () => {
    setNavigatorOnline(false);
    createQueryClient();
    expect(onlineManager.isOnline()).toBe(false);
  });

  it("lance en ligne : en ligne", () => {
    onlineManager.setOnline(false);
    createQueryClient();
    expect(onlineManager.isOnline()).toBe(true);
  });
});
