import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RecipesPage from "./pages/RecipesPage";
import PrivacyPage from "./pages/PrivacyPage";
import SignUpPage from "./pages/SignUpPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import styles from "./styles/App.module.css";

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <div>
          <NavBar />
          <div className={styles.pageContainer}>
            <Routes>
              {/* Public routes */}
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              {/* Protected user routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RecipesPage />
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
