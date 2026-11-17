// Requetes admin des referentiels (C4.3). Cle "admin" : jamais persistee hors ligne.
import {
  adminAislesSchema,
  adminIngredientListSchema,
  adminIngredientSchema,
  adminTagSchema,
  adminUnitSchema,
  listSchema,
  type AdminIngredientTab,
} from "@fm/shared";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export function adminIngredientsQuery(tab: AdminIngredientTab | undefined, query: string) {
  const params = new URLSearchParams({ limit: "100" });
  if (tab) params.set("tab", tab);
  if (query) params.set("query", query);
  return queryOptions({
    queryKey: ["admin", "ingredients", "list", tab ?? "ALL", query],
    queryFn: () => api.get(`/admin/ingredients?${params.toString()}`, adminIngredientListSchema),
  });
}

export function adminIngredientQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "ingredients", id],
    queryFn: () => api.get(`/admin/ingredients/${id}`, adminIngredientSchema),
  });
}

export const adminUnitsQuery = queryOptions({
  queryKey: ["admin", "units"],
  queryFn: async () => (await api.get("/admin/units", listSchema(adminUnitSchema))).data,
});

export const adminAislesQuery = queryOptions({
  queryKey: ["admin", "aisles"],
  queryFn: () => api.get("/admin/aisles", adminAislesSchema),
});

export const adminTagsQuery = queryOptions({
  queryKey: ["admin", "tags"],
  queryFn: async () => (await api.get("/admin/tags", listSchema(adminTagSchema))).data,
});

/** Apres une ecriture sur les ingredients : listes, details et compteurs des rayons. */
export function refreshIngredients(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "ingredients"] }),
    queryClient.invalidateQueries({ queryKey: adminAislesQuery.queryKey }),
  ]);
}
