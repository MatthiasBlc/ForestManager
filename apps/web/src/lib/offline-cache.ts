// Cache hors ligne (D35, C3.9) : TanStack Query garde dans IndexedDB la session,
// les espaces, les unites, les recettes ouvertes et le planning deja lu, 14 jours. A la relecture, chaque
// donnee repasse par son schema : une forme perimee (nouvelle version) est ecartee.
// Deconnexion et connexion vident le client (`queryClient.clear()`), donc l'appareil.
import {
  appConfigSchema,
  mealPlanSettingsSchema,
  mealSchema,
  meSchema,
  recipeSchema,
  spaceDetailSchema,
  spaceSummarySchema,
  unitSchema,
} from "@fm/shared";
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import { createStore, del, get, set } from "idb-keyval";
import { z } from "zod";

export const OFFLINE_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "query-cache";

/** Schema de la donnee d'une cle gardee hors ligne, ou null si la cle n'est pas gardee. */
function schemaOf(key: QueryKey): z.ZodType | null {
  const [root, id, module, kind, recipeId] = key;
  if (key.length === 1 && root === "me") return meSchema.nullable();
  if (key.length === 1 && root === "config") return appConfigSchema;
  if (key.length === 1 && root === "units") return z.array(unitSchema);
  if (root !== "spaces") return null;
  if (key.length === 1) return z.array(spaceSummarySchema);
  if (key.length === 2 && typeof id === "string") return spaceDetailSchema;
  if (key.length === 5 && module === "recipes" && kind === "detail" && typeof recipeId === "string")
    return recipeSchema;
  // Planning (C5.2) : reglages et semaines deja lues.
  if (key.length === 4 && module === "meal-plan" && kind === "settings")
    return mealPlanSettingsSchema;
  if (key.length === 6 && module === "meal-plan" && kind === "meals") return z.array(mealSchema);
  return null;
}

export function isPersisted(key: QueryKey): boolean {
  return schemaOf(key) !== null;
}

export interface OfflineStorage {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
}

function keep(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      mutations: [],
      queries: client.clientState.queries.filter(
        (query) => schemaOf(query.queryKey)?.safeParse(query.state.data).success ?? false
      ),
    },
  };
}

/**
 * Ce qui est relu de l'appareil est perime d'office : affiche tout de suite,
 * redemande au serveur des que le reseau le permet. Sans cela, un rechargement
 * dans les 30 s (`staleTime`) remontrerait l'ancienne donnee sans la verifier.
 */
function stale(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((query) => ({
        ...query,
        state: { ...query.state, isInvalidated: true },
      })),
    },
  };
}

/** `throttleMs` : les evenements du cache sont nombreux, une ecriture par intervalle suffit. */
export function createOfflinePersister(storage: OfflineStorage, throttleMs = 0): Persister {
  let pending: PersistedClient | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    const client = pending;
    pending = null;
    if (client) await storage.set(STORAGE_KEY, keep(client));
  };
  return {
    persistClient: async (client) => {
      pending = client;
      if (throttleMs === 0) return flush();
      timer ??= setTimeout(() => void flush(), throttleMs);
    },
    restoreClient: async () => {
      const stored = (await storage.get(STORAGE_KEY)) as PersistedClient | undefined;
      return stored ? stale(keep(stored)) : undefined;
    },
    removeClient: async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
      await storage.del(STORAGE_KEY);
    },
  };
}

function indexedDbStorage(): OfflineStorage {
  const store = createStore("forest-manager", "offline");
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

/** Options du fournisseur persistant ; allonge la retention des requetes gardees. */
export function offlinePersistOptions(
  client: QueryClient
): Omit<PersistQueryClientOptions, "queryClient"> {
  for (const root of ["me", "config", "units", "spaces"])
    client.setQueryDefaults([root], { gcTime: OFFLINE_MAX_AGE });
  return {
    persister: createOfflinePersister(indexedDbStorage(), 1000),
    maxAge: OFFLINE_MAX_AGE,
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === "success" && isPersisted(query.queryKey),
    },
  };
}
