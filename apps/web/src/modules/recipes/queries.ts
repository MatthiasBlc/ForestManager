// Requetes du module Recettes : liste paginee, detail, referentiels.
import {
  ingredientSchema,
  listSchema,
  pageSchema,
  recipeSchema,
  recipeSummarySchema,
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
  authorId?: string;
  sort?: RecipeSort;
}

const recipePage = pageSchema(recipeSummarySchema);

export const recipesKey = (spaceId: string) => ["spaces", spaceId, "recipes"] as const;

export function recipesQuery(spaceId: string, filters: RecipeFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tagIds?.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.base) params.set("base", "true");
  if (filters.authorId) params.set("authorId", filters.authorId);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  return infiniteQueryOptions({
    queryKey: [...recipesKey(spaceId), "list", params.toString()],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = new URLSearchParams(params);
      if (pageParam) page.set("cursor", pageParam);
      const query = page.toString();
      return api.get(`/spaces/${spaceId}/recipes${query ? `?${query}` : ""}`, recipePage);
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
