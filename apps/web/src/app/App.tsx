// Routes de l'application. Les ecrans publics (acces) arrivent en C2.5.
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { HomeRedirect } from "../core/session/home-redirect.tsx";
import { meQuery } from "../core/session/queries.ts";
import { RequireAuth } from "../core/session/require-auth.tsx";
import { SpaceLayout } from "../core/shell/space-layout.tsx";
import { ThemeController } from "../theme/theme.tsx";
import { ToastProvider } from "../ui/toast.tsx";

const DesignPage = lazy(() =>
  import("../core/design/design-page.tsx").then((m) => ({ default: m.DesignPage }))
);

function SessionTheme() {
  const me = useQuery(meQuery);
  return <ThemeController preferences={me.data?.preferences ?? null} />;
}

export function App() {
  return (
    <ToastProvider>
      <SessionTheme />
      <Routes>
        <Route
          path="/design"
          element={
            <Suspense fallback={null}>
              <DesignPage />
            </Suspense>
          }
        />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/s/:spaceId/*" element={<SpaceLayout />} />
        </Route>
        <Route path="*" element={<main className="fm-root p-4" />} />
      </Routes>
    </ToastProvider>
  );
}
