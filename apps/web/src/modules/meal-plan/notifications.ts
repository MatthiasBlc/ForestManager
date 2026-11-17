// Messages des notifications et de l'activite du Planning (C6.5, D34).
import type { ActivityRenderer, NotificationRenderer } from "../../app/registry.ts";

function from(data: Record<string, unknown> | null): string | null {
  const value = data?.from;
  return typeof value === "string" ? value : null;
}

const planningPath = (spaceId: string, day: string | null) =>
  `/s/${spaceId}/meal-plan${day ? `?day=${day}` : ""}`;

export const MEAL_PLAN_NOTIFICATIONS: Record<string, NotificationRenderer> = {
  "meal-plan.meal.changed": (n) => ({
    text:
      n.count > 1
        ? `a modifié ${String(n.count)} repas du planning de ${n.space?.name ?? ""}.`
        : `a modifié un repas du planning de ${n.space?.name ?? ""}.`,
    to: n.space ? planningPath(n.space.id, null) : null,
  }),
  "meal-plan.plan.generated": (n) => ({
    text: `a généré le planning de ${n.space?.name ?? ""}.`,
    to: n.space ? planningPath(n.space.id, from(n.data)) : null,
  }),
};

export const MEAL_PLAN_ACTIVITY: Record<string, ActivityRenderer> = {
  "meal-plan.plan.generated": (event, spaceId) => ({
    text: "a généré le planning.",
    to: planningPath(spaceId, from(event.data)),
  }),
};
