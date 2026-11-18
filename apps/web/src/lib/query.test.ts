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

// L'admin n'a pas de temps reel [D190] : chaque page relit ses donnees a chaque
// visite, sinon un onglet revu dans les 30 s montre une file perimee.
describe("cache des requetes", () => {
  async function fetchTwice(queryKey: string[]): Promise<number> {
    const client = createQueryClient();
    let calls = 0;
    const queryFn = () => Promise.resolve(++calls);
    await client.query({ queryKey, queryFn });
    await client.query({ queryKey, queryFn });
    return calls;
  }

  it("admin : relue a chaque demande", async () => {
    expect(await fetchTwice(["admin", "module-requests"])).toBe(2);
  });

  it("application : gardee 30 s", async () => {
    expect(await fetchTwice(["spaces"])).toBe(1);
  });
});
