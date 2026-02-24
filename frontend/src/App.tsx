import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import MainLayout from "./components/Layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SocketProvider } from "./contexts/SocketContext";
import { useNotificationToasts } from "./hooks/useNotificationToasts";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import RecipeFormPage from "./pages/RecipeFormPage";
import PrivacyPage from "./pages/PrivacyPage";
import SignUpPage from "./pages/SignUpPage";
import NotFoundPage from "./pages/NotFoundPage";
import DashboardPage from "./pages/DashboardPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityCreatePage from "./pages/CommunityCreatePage";
import CommunityDetailPage from "./pages/CommunityDetailPage";
import CommunityEditPage from "./pages/CommunityEditPage";
import InvitationsPage from "./pages/InvitationsPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminTagsPage from "./pages/admin/AdminTagsPage";
import AdminIngredientsPage from "./pages/admin/AdminIngredientsPage";
import AdminUnitsPage from "./pages/admin/AdminUnitsPage";
import AdminFeaturesPage from "./pages/admin/AdminFeaturesPage";
import AdminCommunitiesPage from "./pages/admin/AdminCommunitiesPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";

function NotificationHandler() {
  useNotificationToasts();
  return null;
}

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SocketProvider>
        <NotificationHandler />
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <ErrorBoundary>
          <div className="flex-1 flex flex-col">
            <Routes>
              {/* Public routes - no sidebar */}
              <Route path="/" element={<HomePage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              {/* Dashboard - authenticated home page */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <DashboardPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Protected user routes - with sidebar layout */}
              <Route
                path="/recipes"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipesPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recipes/new"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipeFormPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recipes/:id"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipeDetailPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recipes/:id/edit"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipeFormPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Community routes - with sidebar layout */}
              <Route
                path="/communities"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <CommunitiesPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/communities/create"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <CommunityCreatePage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/communities/:id"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <CommunityDetailPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/communities/:id/edit"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <CommunityEditPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/communities/:communityId/recipes/new"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipeFormPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Profile route */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <ProfilePage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Notifications route */}
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <NotificationsPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Invitations route - with sidebar layout */}
              <Route
                path="/invitations"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <InvitationsPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Admin routes - isolated auth context */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="login" element={<AdminLoginPage />} />
                <Route
                  path="dashboard"
                  element={
                    <AdminProtectedRoute>
                      <AdminDashboardPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="tags"
                  element={
                    <AdminProtectedRoute>
                      <AdminTagsPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="ingredients"
                  element={
                    <AdminProtectedRoute>
                      <AdminIngredientsPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="units"
                  element={
                    <AdminProtectedRoute>
                      <AdminUnitsPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="features"
                  element={
                    <AdminProtectedRoute>
                      <AdminFeaturesPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="communities"
                  element={
                    <AdminProtectedRoute>
                      <AdminCommunitiesPage />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="activity"
                  element={
                    <AdminProtectedRoute>
                      <AdminActivityPage />
                    </AdminProtectedRoute>
                  }
                />
              </Route>

              <Route path="/*" element={<NotFoundPage />} />
            </Routes>
          </div>
          </ErrorBoundary>
          <LoginModal />
          <Toaster position="top-right" />
        </div>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
