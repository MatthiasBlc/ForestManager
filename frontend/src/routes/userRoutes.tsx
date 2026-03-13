/* eslint-disable react-refresh/only-export-components */
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import MainLayout from "../components/Layout/MainLayout";
import HomePage from "../pages/HomePage";
import RecipesPage from "../pages/RecipesPage";
import RecipeDetailPage from "../pages/RecipeDetailPage";
import RecipeFormPage from "../pages/RecipeFormPage";
import PrivacyPage from "../pages/PrivacyPage";
import SignUpPage from "../pages/SignUpPage";
import NotFoundPage from "../pages/NotFoundPage";
import DashboardPage from "../pages/DashboardPage";
import CommunitiesPage from "../pages/CommunitiesPage";
import CommunityCreatePage from "../pages/CommunityCreatePage";
import CommunityDetailPage from "../pages/CommunityDetailPage";
import CommunityEditPage from "../pages/CommunityEditPage";
import InvitationsPage from "../pages/InvitationsPage";
import NotificationsPage from "../pages/NotificationsPage";
import ProfilePage from "../pages/ProfilePage";

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

const userRoutes = (
  <>
    {/* Public routes */}
    <Route path="/" element={<HomePage />} />
    <Route path="/signup" element={<SignUpPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />

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
          <RecipeFormPage />
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
          <RecipeFormPage />
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
          <CommunityCreatePage />
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
          <CommunityEditPage />
        </ProtectedPage>
      }
    />
    <Route
      path="/communities/:communityId/recipes/new"
      element={
        <ProtectedPage>
          <RecipeFormPage />
        </ProtectedPage>
      }
    />

    {/* Profile */}
    <Route
      path="/profile"
      element={
        <ProtectedPage>
          <ProfilePage />
        </ProtectedPage>
      }
    />

    {/* Notifications */}
    <Route
      path="/notifications"
      element={
        <ProtectedPage>
          <NotificationsPage />
        </ProtectedPage>
      }
    />

    {/* Invitations */}
    <Route
      path="/invitations"
      element={
        <ProtectedPage>
          <InvitationsPage />
        </ProtectedPage>
      }
    />

    <Route path="/*" element={<NotFoundPage />} />
  </>
);

export default userRoutes;
