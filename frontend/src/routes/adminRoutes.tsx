import { Route } from "react-router-dom";
import AdminProtectedRoute from "../components/admin/AdminProtectedRoute";
import AdminLayout from "../components/admin/AdminLayout";
import AdminLoginPage from "../pages/admin/AdminLoginPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminTagsPage from "../pages/admin/AdminTagsPage";
import AdminIngredientsPage from "../pages/admin/AdminIngredientsPage";
import AdminUnitsPage from "../pages/admin/AdminUnitsPage";
import AdminFeaturesPage from "../pages/admin/AdminFeaturesPage";
import AdminCommunitiesPage from "../pages/admin/AdminCommunitiesPage";
import AdminActivityPage from "../pages/admin/AdminActivityPage";

function AdminPage({ children }: { children: React.ReactNode }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}

const adminRoutes = (
  <Route path="/admin" element={<AdminLayout />}>
    <Route path="login" element={<AdminLoginPage />} />
    <Route
      path="dashboard"
      element={
        <AdminPage>
          <AdminDashboardPage />
        </AdminPage>
      }
    />
    <Route
      path="tags"
      element={
        <AdminPage>
          <AdminTagsPage />
        </AdminPage>
      }
    />
    <Route
      path="ingredients"
      element={
        <AdminPage>
          <AdminIngredientsPage />
        </AdminPage>
      }
    />
    <Route
      path="units"
      element={
        <AdminPage>
          <AdminUnitsPage />
        </AdminPage>
      }
    />
    <Route
      path="features"
      element={
        <AdminPage>
          <AdminFeaturesPage />
        </AdminPage>
      }
    />
    <Route
      path="communities"
      element={
        <AdminPage>
          <AdminCommunitiesPage />
        </AdminPage>
      }
    />
    <Route
      path="activity"
      element={
        <AdminPage>
          <AdminActivityPage />
        </AdminPage>
      }
    />
  </Route>
);

export default adminRoutes;
