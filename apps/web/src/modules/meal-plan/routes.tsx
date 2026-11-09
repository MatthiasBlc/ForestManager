// Routes du module Planning, relatives a /s/:spaceId/meal-plan.
import { Route, Routes } from "react-router";

import { PlanningPage } from "./planning-page.tsx";

export default function MealPlanRoutes() {
  return (
    <Routes>
      <Route index element={<PlanningPage />} />
    </Routes>
  );
}
