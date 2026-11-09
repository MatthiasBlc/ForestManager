// Administration de la plateforme sous /admin, chargee a part (lazy) [D170].
// Sans session admin complete, toute adresse /admin affiche la connexion.
import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router";

import { Skeleton } from "../../ui/display.tsx";
import { AdminDashboardPage } from "./admin-dashboard-page.tsx";
import { AdminLayout } from "./admin-layout.tsx";
import { AdminLoginPage } from "./admin-login-page.tsx";
import { AislesPage } from "./aisles-page.tsx";
import { IngredientsPage } from "./ingredients-page.tsx";
import { ModerationPage } from "./moderation-page.tsx";
import { ModuleRequestsPage } from "./module-requests-page.tsx";
import { ModulesCatalogPage } from "./modules-catalog-page.tsx";
import { adminMeQuery } from "./queries.ts";
import { SpacesPage } from "./spaces-page.tsx";
import { TagsPage } from "./tags-page.tsx";
import { UnitsPage } from "./units-page.tsx";
import { UsersPage } from "./users-page.tsx";

export function AdminApp() {
  const me = useQuery(adminMeQuery);
  if (me.isPending) return <Skeleton label="Chargement de la session admin" />;
  if (!me.data) return <AdminLoginPage />;
  return (
    <Routes>
      <Route element={<AdminLayout me={me.data} />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="requests" element={<ModuleRequestsPage />} />
        <Route path="modules" element={<ModulesCatalogPage />} />
        <Route path="ingredients" element={<IngredientsPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="aisles" element={<AislesPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="spaces" element={<SpacesPage />} />
        <Route path="moderation/:spaceId" element={<ModerationPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

export default AdminApp;
