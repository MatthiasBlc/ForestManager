// Faux serveur du module Planning (MSW) sur l'espace groupe de spaceServer :
// module actif, reglages et droits du lecteur. Garde l'etat et les corps recus.
import {
  sortMealTimes,
  type MealPlanRights,
  type MealPlanSettings,
  type SpaceRole,
  type UpdateMealPlanSettingsBody,
} from "@fm/shared";
import { http, HttpResponse } from "msw";

import { server } from "./server.ts";
import { spaceServer } from "./space-server.ts";

function rightsFor(role: SpaceRole, editRole: SpaceRole): MealPlanRights {
  const rank = { MEMBER: 0, MODERATOR: 1, OWNER: 2 } as const;
  return {
    edit: rank[role] >= rank[editRole],
    manage: rank[role] >= rank.MODERATOR,
    setEditRole: role === "OWNER",
  };
}

export function mealPlanServer({
  myRole = "MEMBER",
  settings = {},
}: { myRole?: SpaceRole; settings?: Partial<Omit<MealPlanSettings, "can">> } = {}) {
  const s = spaceServer({ myRole });
  s.space.modules = [
    { code: "recipes", sortOrder: 0 },
    { code: "meal-plan", sortOrder: 1 },
  ];
  const values = {
    mealTimes: ["LUNCH", "DINNER"],
    defaultServings: 4,
    weekStartsOn: "MON",
    editRole: "MEMBER",
    ...settings,
  } as Omit<MealPlanSettings, "can">;
  const state = { settings: values, saved: [] as UpdateMealPlanSettingsBody[] };
  const base = `/api/v1/spaces/${s.space.id}/meal-plan`;
  const current = (): MealPlanSettings => ({
    ...state.settings,
    can: rightsFor(myRole, state.settings.editRole),
  });
  server.use(
    http.get(`${base}/settings`, () => HttpResponse.json(current())),
    http.put(`${base}/settings`, async ({ request }) => {
      const body = (await request.json()) as UpdateMealPlanSettingsBody;
      state.saved.push(body);
      state.settings = {
        ...state.settings,
        ...body,
        mealTimes: sortMealTimes(body.mealTimes),
        editRole: body.editRole ?? state.settings.editRole,
      };
      return HttpResponse.json(current());
    })
  );
  return { ...s, plan: state };
}
