// Routes de l'application.
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { LoginPage } from "../core/access/login-page.tsx";
import { ForgotPasswordPage, ResetPasswordPage } from "../core/access/password-pages.tsx";
import { RegisterPage } from "../core/access/register-page.tsx";
import { VerifyEmailPage } from "../core/access/verify-email-page.tsx";
import { WelcomePage } from "../core/access/welcome-page.tsx";
import { GuestOnly } from "../core/session/guest-only.tsx";
import { meQuery } from "../core/session/queries.ts";
import { RequireAuth } from "../core/session/require-auth.tsx";
import { RootPage } from "../core/session/root-page.tsx";
import { JoinPage } from "../core/spaces/join-page.tsx";
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
        <Route path="/" element={<RootPage />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/s/:spaceId/*" element={<SpaceLayout />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
