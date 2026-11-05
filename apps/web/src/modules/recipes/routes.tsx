// Routes du module Recettes (C3 les remplit).
import { Route, Routes } from "react-router";

import { EmptyState } from "../../ui/display.tsx";

function Pending({ title }: { title: string }) {
  return (
    <div className="p-4">
      <EmptyState title={title}>Les recettes arrivent bientôt dans cette version.</EmptyState>
    </div>
  );
}

export default function RecipesRoutes() {
  return (
    <Routes>
      <Route index element={<Pending title="Recettes" />} />
      <Route path="mine" element={<Pending title="Mes recettes" />} />
    </Routes>
  );
}
