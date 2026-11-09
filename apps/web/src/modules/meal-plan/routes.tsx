// Routes du module Planning, relatives a /s/:spaceId/meal-plan.
import { Route, Routes } from "react-router";

import { IdeasPage } from "./ideas-page.tsx";
import { PlanningPage } from "./planning-page.tsx";
import { ProfilesPage } from "./profiles-page.tsx";

export default function MealPlanRoutes() {
  return (
    <Routes>
      <Route index element={<PlanningPage />} />
      <Route path="ideas" element={<IdeasPage />} />
      <Route path="profiles" element={<ProfilesPage />} />
    </Routes>
  );
}
