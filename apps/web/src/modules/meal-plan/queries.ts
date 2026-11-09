// Requetes du module Planning.
import { mealPlanSettingsSchema } from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const mealPlanKey = (spaceId: string) => ["spaces", spaceId, "meal-plan"] as const;

export function settingsQuery(spaceId: string) {
  return queryOptions({
    queryKey: [...mealPlanKey(spaceId), "settings"],
    queryFn: () => api.get(`/spaces/${spaceId}/meal-plan/settings`, mealPlanSettingsSchema),
  });
}
