// Recherche globale, groupe et action du Planning [D119, D191].
import type { MealTime } from "@fm/shared";

import type { PaletteAction, SearchGroupView } from "../../app/registry.ts";
import { whenLabel } from "./dates.ts";

export const MEAL_PLAN_SEARCH_GROUPS: Readonly<Record<string, SearchGroupView>> = {
  "meal-plan.meals": {
    label: "Planning",
    render: (item) => {
      const date = String(item.data.date);
      return {
        label: `${whenLabel(date, item.data.mealTime as MealTime)} : ${item.title}`,
        icon: "calendar",
        hint: item.spaceName,
        to: `/s/${item.spaceId}/meal-plan?day=${date}`,
      };
    },
  },
};

/** La feuille ne s'ouvre que pour qui peut generer (droit lu par l'ecran). */
export function mealPlanActions(space: { id: string }): PaletteAction[] {
  return [
    {
      id: "meal-plan.generate",
      label: "Générer le planning",
      icon: "sparkles",
      to: `/s/${space.id}/meal-plan?generate=1`,
      keywords: "semaine repas",
    },
  ];
}
