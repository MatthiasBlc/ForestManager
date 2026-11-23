// Routes du module Liste de courses, relatives a /s/:spaceId/shopping.
import { Route, Routes } from "react-router";

import { ShoppingPage } from "./shopping-page.tsx";

export default function ShoppingRoutes() {
  return (
    <Routes>
      <Route index element={<ShoppingPage />} />
    </Routes>
  );
}
