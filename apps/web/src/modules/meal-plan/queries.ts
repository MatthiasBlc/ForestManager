// Requetes du module Planning.
import {
  generationProfileSchema,
  generationProfileSummarySchema,
  listSchema,
  mealIdeaSchema,
  mealPlanSettingsSchema,
  mealSchema,
} from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const mealPlanKey = (spaceId: string) => ["spaces", spaceId, "meal-plan"] as const;

export function settingsQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...mealPlanKey(spaceId), "settings"],
    queryFn: () => api.get(`/spaces/${spaceId}/meal-plan/settings`, mealPlanSettingsSchema),
  });
}

/** Prefixe de toutes les periodes lues : a invalider apres une ecriture. */
export const mealsKey = (spaceId: string) => [...mealPlanKey(spaceId), "meals"] as const;

export function mealsQuery(spaceId: string, from: string, to: string) {
  return queryOptions({
    queryKey: [...mealsKey(spaceId), from, to],
    queryFn: async () =>
      (
        await api.get(
          `/spaces/${spaceId}/meal-plan/meals?from=${from}&to=${to}`,
          listSchema(mealSchema)
        )
      ).data,
  });
}

export function ideasQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...mealPlanKey(spaceId), "ideas"],
    queryFn: async () =>
      (await api.get(`/spaces/${spaceId}/meal-plan/ideas`, listSchema(mealIdeaSchema))).data,
  });
}

export const profilesKey = (spaceId: string) => [...mealPlanKey(spaceId), "profiles"] as const;

export function profilesQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...profilesKey(spaceId), "list"],
    queryFn: async () =>
      (
        await api.get(
          `/spaces/${spaceId}/meal-plan/profiles`,
          listSchema(generationProfileSummarySchema)
        )
      ).data,
  });
}

export function profileQuery(spaceId: string, profileId: string) {
  return queryOptions({
    queryKey: [...profilesKey(spaceId), profileId],
    queryFn: () =>
      api.get(`/spaces/${spaceId}/meal-plan/profiles/${profileId}`, generationProfileSchema),
  });
}
