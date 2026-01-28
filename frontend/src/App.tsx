import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import MainLayout from "./components/Layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import RecipeFormPage from "./pages/RecipeFormPage";
import PrivacyPage from "./pages/PrivacyPage";
import SignUpPage from "./pages/SignUpPage";
import NotFoundPage from "./pages/NotFoundPage";
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
          <div className="flex-1">
            <Routes>
              {/* Public routes - no sidebar */}
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              {/* Protected user routes - with sidebar layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <RecipesPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
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
          <LoginModal />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
