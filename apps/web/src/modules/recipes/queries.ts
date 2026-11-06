// Requetes du module Recettes : liste paginee, detail, historique, partage, referentiels.
import {
  ingredientSchema,
  listSchema,
  pageSchema,
  recipeLeavePreviewSchema,
  recipeRevisionSchema,
  recipeSchema,
  recipeSharingSchema,
  recipeSummarySchema,
  shareRequestSchema,
  tagSchema,
  unitSchema,
  type RecipeSort,
} from "@fm/shared";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export interface RecipeFilters {
  q?: string;
  tagIds?: string[];
  base?: boolean;
  sort?: RecipeSort;
  /** "Mes recettes" [D82] : recettes de l'utilisateur dans tous ses espaces. */
  mine?: boolean;
}

const recipePage = pageSchema(recipeSummarySchema);

export const recipesKey = (spaceId: string) => ["spaces", spaceId, "recipes"] as const;

export function recipesQuery(spaceId: string, filters: RecipeFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tagIds?.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.base) params.set("base", "true");
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  const path = `/spaces/${spaceId}/recipes${filters.mine ? "/mine" : ""}`;
  return infiniteQueryOptions({
    queryKey: [...recipesKey(spaceId), "list", filters.mine ? "mine" : "space", params.toString()],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = new URLSearchParams(params);
      if (pageParam) page.set("cursor", pageParam);
      const query = page.toString();
      return api.get(`${path}${query ? `?${query}` : ""}`, recipePage);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function recipeQuery(spaceId: string, recipeId: string) {
  return queryOptions({
    queryKey: [...recipesKey(spaceId), "detail", recipeId],
    queryFn: () => api.get(`/spaces/${spaceId}/recipes/${recipeId}`, recipeSchema),
  });
}

/** Sous la cle du detail : invalider le detail rafraichit aussi l'historique. */
export function revisionsQuery(spaceId: string, recipeId: string) {
  return queryOptions({
    queryKey: [...recipeQuery(spaceId, recipeId).queryKey, "revisions"],
    queryFn: async () =>
      (
        await api.get(
          `/spaces/${spaceId}/recipes/${recipeId}/revisions`,
          listSchema(recipeRevisionSchema)
        )
      ).data,
  });
}

/** Sous la cle du detail : invalider le detail rafraichit aussi le partage. */
export function sharingQuery(spaceId: string, recipeId: string) {
  return queryOptions({
    queryKey: [...recipeQuery(spaceId, recipeId).queryKey, "sharing"],
    queryFn: () => api.get(`/spaces/${spaceId}/recipes/${recipeId}/sharing`, recipeSharingSchema),
  });
}

export function shareRequestsQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...recipesKey(spaceId), "share-requests"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/recipes/share-requests`, listSchema(shareRequestSchema)))
        .data,
  });
}

export function leavePreviewQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...recipesKey(spaceId), "leave-preview"],
    queryFn: () => api.get(`/spaces/${spaceId}/recipes/leave-preview`, recipeLeavePreviewSchema),
    staleTime: 0,
  });
}

export const unitsQuery = queryOptions({
  queryKey: ["units"],
  queryFn: async () => (await api.get("/units", listSchema(unitSchema))).data,
  staleTime: Infinity,
});

export const globalTagsQuery = queryOptions({
  queryKey: ["tags"],
  queryFn: async () => (await api.get("/tags", listSchema(tagSchema))).data,
  staleTime: 5 * 60_000,
});

export function spaceTagsQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...recipesKey(spaceId), "tags"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/recipes/tags`, listSchema(tagSchema))).data,
  });
}

export function ingredientSearchQuery(term: string) {
  return queryOptions({
    queryKey: ["ingredients", term],
    queryFn: async () =>
      (
        await api.get(
          `/ingredients?q=${encodeURIComponent(term)}&limit=6`,
          listSchema(ingredientSchema)
        )
      ).data,
    enabled: term.trim().length > 0,
    staleTime: 60_000,
  });
}
