// Routes du module Recettes, relatives a /s/:spaceId/recipes.
import { Route, Routes } from "react-router";

import { ComparePage } from "./compare-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { RecipeEditorPage } from "./recipe-editor-page.tsx";
import { RecipePage } from "./recipe-page.tsx";
import { RecipesPage } from "./recipes-page.tsx";

export default function RecipesRoutes() {
  return (
    <Routes>
      <Route index element={<RecipesPage />} />
      {/* Vue "Mes recettes" de l'espace perso : C3.5 y ajoutera les recettes des autres espaces (D82). */}
      <Route path="mine" element={<RecipesPage mine />} />
      <Route path="new" element={<RecipeEditorPage />} />
      <Route path=":recipeId" element={<RecipePage />} />
      <Route path=":recipeId/edit" element={<RecipeEditorPage />} />
      <Route path=":recipeId/history" element={<HistoryPage />} />
      <Route path=":recipeId/compare" element={<ComparePage />} />
    </Routes>
  );
}
