/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import MainLayout from "../components/Layout/MainLayout";
import HomePage from "../pages/HomePage";
import NotFoundPage from "../pages/NotFoundPage";

// Eager: pages les plus visitees
import DashboardPage from "../pages/DashboardPage";
import RecipesPage from "../pages/RecipesPage";
import RecipeDetailPage from "../pages/RecipeDetailPage";
import CommunityDetailPage from "../pages/CommunityDetailPage";
import CommunitiesPage from "../pages/CommunitiesPage";

// Lazy: pages moins frequentes
const RecipeFormPage = lazy(() => import("../pages/RecipeFormPage"));
const SignUpPage = lazy(() => import("../pages/SignUpPage"));
const PrivacyPage = lazy(() => import("../pages/PrivacyPage"));
const CommunityCreatePage = lazy(() => import("../pages/CommunityCreatePage"));
const CommunityEditPage = lazy(() => import("../pages/CommunityEditPage"));
const InvitationsPage = lazy(() => import("../pages/InvitationsPage"));
const NotificationsPage = lazy(() => import("../pages/NotificationsPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

const fallback = (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-accent" />
  </div>
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

const userRoutes = (
  <>
    {/* Public routes */}
    <Route path="/" element={<HomePage />} />
    <Route
      path="/signup"
      element={
        <LazyPage>
          <SignUpPage />
        </LazyPage>
      }
    />
    <Route
      path="/privacy"
      element={
        <LazyPage>
          <PrivacyPage />
        </LazyPage>
      }
    />

    {/* Dashboard */}
    <Route
      path="/dashboard"
      element={
        <ProtectedPage>
          <DashboardPage />
        </ProtectedPage>
      }
    />

    {/* Recipes */}
    <Route
      path="/recipes"
      element={
        <ProtectedPage>
          <RecipesPage />
        </ProtectedPage>
      }
    />
    <Route
      path="/recipes/new"
      element={
        <ProtectedPage>
          <LazyPage>
            <RecipeFormPage />
          </LazyPage>
        </ProtectedPage>
      }
    />
    <Route
      path="/recipes/:id"
      element={
        <ProtectedPage>
          <RecipeDetailPage />
        </ProtectedPage>
      }
    />
    <Route
      path="/recipes/:id/edit"
      element={
        <ProtectedPage>
          <LazyPage>
            <RecipeFormPage />
          </LazyPage>
        </ProtectedPage>
      }
    />

    {/* Communities */}
    <Route
      path="/communities"
      element={
        <ProtectedPage>
          <CommunitiesPage />
        </ProtectedPage>
      }
    />
    <Route
      path="/communities/create"
      element={
        <ProtectedPage>
          <LazyPage>
            <CommunityCreatePage />
          </LazyPage>
        </ProtectedPage>
      }
    />
    <Route
      path="/communities/:id"
      element={
        <ProtectedPage>
          <CommunityDetailPage />
        </ProtectedPage>
      }
    />
    <Route
      path="/communities/:id/edit"
      element={
        <ProtectedPage>
          <LazyPage>
            <CommunityEditPage />
          </LazyPage>
        </ProtectedPage>
      }
    />
    <Route
      path="/communities/:communityId/recipes/new"
      element={
        <ProtectedPage>
          <LazyPage>
            <RecipeFormPage />
          </LazyPage>
        </ProtectedPage>
      }
    />

    {/* Profile */}
    <Route
      path="/profile"
      element={
        <ProtectedPage>
          <LazyPage>
            <ProfilePage />
          </LazyPage>
        </ProtectedPage>
      }
    />

    {/* Notifications */}
    <Route
      path="/notifications"
      element={
        <ProtectedPage>
          <LazyPage>
            <NotificationsPage />
          </LazyPage>
        </ProtectedPage>
      }
    />

    {/* Invitations */}
    <Route
      path="/invitations"
      element={
        <ProtectedPage>
          <LazyPage>
            <InvitationsPage />
          </LazyPage>
        </ProtectedPage>
      }
    />

    <Route path="/*" element={<NotFoundPage />} />
  </>
);

export default userRoutes;
