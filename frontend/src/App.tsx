import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import MainLayout from "./components/Layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
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
import ProfilePage from "./pages/ProfilePage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
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
              </Route>

              <Route path="/*" element={<NotFoundPage />} />
            </Routes>
          </div>
          </ErrorBoundary>
          <LoginModal />
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
