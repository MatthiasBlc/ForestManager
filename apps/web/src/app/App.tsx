import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

const DesignPage = lazy(() =>
  import("../core/design/design-page.tsx").then((m) => ({ default: m.DesignPage }))
);

// Routes de l'application (completees par le shell et les ecrans en C2.4 et suivants).
export function App() {
  return (
    <Routes>
      <Route
        path="/design"
        element={
          <Suspense fallback={null}>
            <DesignPage />
          </Suspense>
        }
      />
      <Route path="*" element={<main className="fm-root p-4" />} />
    </Routes>
  );
}
