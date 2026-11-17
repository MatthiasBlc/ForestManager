// Cache hors ligne (D35, C3.9) : ce qui est garde sur l'appareil et ce qui est relu.
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";

import { buildRecipe, UNITS } from "../test/fixtures.ts";
import { createOfflinePersister, isPersisted, type OfflineStorage } from "./offline-cache.ts";

const SPACE = "11111111-1111-4111-8111-111111111111";
const RECIPE = "22222222-2222-4222-8222-222222222222";

function memoryStorage(): OfflineStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    del: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

function client(queries: { queryKey: unknown[]; data: unknown }[]): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: "",
    clientState: {
      mutations: [],
      queries: queries.map(({ queryKey, data }) => ({
        queryKey,
        queryHash: JSON.stringify(queryKey),
        state: {
          data,
          dataUpdateCount: 1,
          dataUpdatedAt: Date.now(),
          error: null,
          errorUpdateCount: 0,
          errorUpdatedAt: 0,
          fetchFailureCount: 0,
          fetchFailureReason: null,
          fetchMeta: null,
          isInvalidated: false,
          status: "success",
          fetchStatus: "idle",
        },
        dehydratedAt: Date.now(),
      })),
    },
  };
}

describe("ce qui est garde hors ligne", () => {
  it("session, espaces, unites et recettes ouvertes", () => {
    expect(isPersisted(["me"])).toBe(true);
    expect(isPersisted(["config"])).toBe(true);
    expect(isPersisted(["spaces"])).toBe(true);
    expect(isPersisted(["spaces", SPACE])).toBe(true);
    expect(isPersisted(["units"])).toBe(true);
    expect(isPersisted(["spaces", SPACE, "recipes", "detail", RECIPE])).toBe(true);
  });

  it("planning : reglages et semaines lues (D169, C5.2), pas les recherches", () => {
    expect(isPersisted(["spaces", SPACE, "meal-plan", "settings"])).toBe(true);
    expect(isPersisted(["spaces", SPACE, "meal-plan", "meals", "2026-11-09", "2026-11-15"])).toBe(
      true
    );
    expect(isPersisted(["spaces", SPACE, "meal-plan", "search", "", "dahl"])).toBe(false);
  });

  it("ni les listes, ni l'historique, ni les recherches", () => {
    expect(isPersisted(["spaces", SPACE, "recipes", "list", "space", ""])).toBe(false);
    expect(isPersisted(["spaces", SPACE, "recipes", "detail", RECIPE, "revisions"])).toBe(false);
    expect(isPersisted(["ingredients", "tom"])).toBe(false);
    expect(isPersisted(["spaces", SPACE, "members"])).toBe(false);
  });
});

describe("persistance sur l'appareil", () => {
  it("relit ce qui a ete ecrit", async () => {
    const storage = memoryStorage();
    const persister = createOfflinePersister(storage);
    const recipe = buildRecipe();
    await persister.persistClient(
      client([
        { queryKey: ["units"], data: UNITS },
        { queryKey: ["spaces", SPACE, "recipes", "detail", recipe.id], data: recipe },
      ])
    );
    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries.map((query) => query.queryKey)).toEqual([
      ["units"],
      ["spaces", SPACE, "recipes", "detail", recipe.id],
    ]);
  });

  it("rend ce qui est relu perime : un rechargement redemande au serveur", async () => {
    const storage = memoryStorage();
    const persister = createOfflinePersister(storage);
    // Ecrit a l'instant : sans cela, la donnee resterait "fraiche" 30 s apres le rechargement.
    await persister.persistClient(client([{ queryKey: ["units"], data: UNITS }]));
    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries.map((query) => query.state.isInvalidated)).toEqual([true]);
  });

  it("ecarte a la relecture une donnee qui ne correspond plus au contrat", async () => {
    const storage = memoryStorage();
    const persister = createOfflinePersister(storage);
    await persister.persistClient(
      client([
        { queryKey: ["units"], data: UNITS },
        // Ancienne forme d'une recette (version precedente de l'application).
        { queryKey: ["spaces", SPACE, "recipes", "detail", RECIPE], data: { id: RECIPE } },
        { queryKey: ["inconnu"], data: 1 },
      ])
    );
    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries.map((query) => query.queryKey)).toEqual([["units"]]);
  });

  it("ne garde pas l'absence de session : un rechargement la redemande au serveur", async () => {
    // Deconnexion puis connexion en moins d'une ecriture (C7.6) : la copie disait
    // encore "pas de session" et renvoyait vers la connexion une session valide.
    const storage = memoryStorage();
    const persister = createOfflinePersister(storage);
    await persister.persistClient(
      client([
        { queryKey: ["me"], data: null },
        { queryKey: ["units"], data: UNITS },
      ])
    );
    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries.map((query) => query.queryKey)).toEqual([["units"]]);
  });

  it("oublier le client efface tout", async () => {
    const storage = memoryStorage();
    const persister = createOfflinePersister(storage);
    await persister.persistClient(client([{ queryKey: ["units"], data: UNITS }]));
    await persister.removeClient();
    expect(storage.data.size).toBe(0);
    expect(await persister.restoreClient()).toBeUndefined();
  });
});
