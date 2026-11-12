// Routes du module Recettes, relatives a /s/:spaceId/recipes.
import { Navigate, Route, Routes } from "react-router";

import { ComparePage } from "./compare-page.tsx";
import { CookPage } from "./cook-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { RecipeEditorPage } from "./recipe-editor-page.tsx";
import { RecipePage } from "./recipe-page.tsx";
import { RecipesPage } from "./recipes-page.tsx";
import { SuggestionPage } from "./suggestion-page.tsx";

export default function RecipesRoutes() {
  return (
    <Routes>
      <Route index element={<RecipesPage />} />
      {/* Ancien onglet "Mes recettes" : la liste de l'espace perso l'a remplace (D207). */}
      <Route path="mine" element={<Navigate to=".." relative="path" replace />} />
      <Route path="new" element={<RecipeEditorPage />} />
      <Route path=":recipeId" element={<RecipePage />} />
      <Route path=":recipeId/edit" element={<RecipeEditorPage />} />
      <Route path=":recipeId/cook" element={<CookPage />} />
      <Route path=":recipeId/history" element={<HistoryPage />} />
      <Route path=":recipeId/compare" element={<ComparePage />} />
      <Route path=":recipeId/suggest" element={<RecipeEditorPage suggest />} />
      <Route path=":recipeId/suggestions/:suggestionId" element={<SuggestionPage />} />
    </Routes>
  );
}
