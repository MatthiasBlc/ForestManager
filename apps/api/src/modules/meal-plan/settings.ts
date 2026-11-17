// Reglages du planning d'un espace [D11, D58, D180] : pas de ligne en base =
// valeurs par defaut du schema ; la ligne est creee au premier enregistrement.
import {
  sortMealTimes,
  type MealPlanRights,
  type MealPlanSettings,
  type MealTime,
  type SpaceRole,
  type UpdateMealPlanSettingsBody,
  type Weekday,
} from "@fm/shared";

import type { Db } from "../../core/db/client.ts";

export interface SettingsValues {
  mealTimes: MealTime[];
  defaultServings: number;
  weekStartsOn: Weekday;
  editRole: SpaceRole;
}

export const DEFAULT_SETTINGS: Readonly<SettingsValues> = {
  mealTimes: ["LUNCH", "DINNER"],
  defaultServings: 4,
  weekStartsOn: "MON",
  editRole: "MEMBER",
};

export async function readSettings(db: Db, spaceId: string): Promise<SettingsValues> {
  const row = await db.mealPlanSettings.findUnique({ where: { spaceId } });
  if (!row) return { ...DEFAULT_SETTINGS, mealTimes: [...DEFAULT_SETTINGS.mealTimes] };
  return {
    mealTimes: sortMealTimes(row.mealTimes),
    defaultServings: row.defaultServings,
    weekStartsOn: row.weekStartsOn,
    editRole: row.editRole,
  };
}

/** `editRole` n'est ecrit que si l'appelant peut le changer (verifie par la route). */
export async function saveSettings(
  db: Db,
  spaceId: string,
  body: UpdateMealPlanSettingsBody
): Promise<SettingsValues> {
  const data = {
    mealTimes: sortMealTimes(body.mealTimes),
    defaultServings: body.defaultServings,
    weekStartsOn: body.weekStartsOn,
    ...(body.editRole ? { editRole: body.editRole } : {}),
  };
  await db.mealPlanSettings.upsert({
    where: { spaceId },
    create: { spaceId, ...data },
    update: data,
  });
  return readSettings(db, spaceId);
}

export function toSettings(values: SettingsValues, can: MealPlanRights): MealPlanSettings {
  return { ...values, can };
}
