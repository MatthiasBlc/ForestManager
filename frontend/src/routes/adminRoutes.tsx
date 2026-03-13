/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import AdminProtectedRoute from "../components/admin/AdminProtectedRoute";
import AdminLayout from "../components/admin/AdminLayout";

const AdminLoginPage = lazy(() => import("../pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminTagsPage = lazy(() => import("../pages/admin/AdminTagsPage"));
const AdminIngredientsPage = lazy(() => import("../pages/admin/AdminIngredientsPage"));
const AdminUnitsPage = lazy(() => import("../pages/admin/AdminUnitsPage"));
const AdminFeaturesPage = lazy(() => import("../pages/admin/AdminFeaturesPage"));
const AdminCommunitiesPage = lazy(() => import("../pages/admin/AdminCommunitiesPage"));
const AdminActivityPage = lazy(() => import("../pages/admin/AdminActivityPage"));

function AdminPage({ children }: { children: React.ReactNode }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}

const fallback = (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-accent" />
  </div>
);

const adminRoutes = (
  <Route path="/admin" element={<AdminLayout />}>
    <Route
      path="login"
      element={
        <Suspense fallback={fallback}>
          <AdminLoginPage />
        </Suspense>
      }
    />
    <Route
      path="dashboard"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminDashboardPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="tags"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminTagsPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="ingredients"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminIngredientsPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="units"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminUnitsPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="features"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminFeaturesPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="communities"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminCommunitiesPage />
          </Suspense>
        </AdminPage>
      }
    />
    <Route
      path="activity"
      element={
        <AdminPage>
          <Suspense fallback={fallback}>
            <AdminActivityPage />
          </Suspense>
        </AdminPage>
      }
    />
  </Route>
);

export default adminRoutes;
