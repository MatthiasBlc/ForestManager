import { useEffect, useState } from "react";
import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import SignUpModal from "./components/SignUpModal";
import { User } from "./models/user";
import APIManager from "./network/api";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RecipesPage from "./pages/RecipesPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import styles from "./styles/App.module.css";

function App() {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    async function fetchLoggedInUser() {
      try {
        const user = await APIManager.getLoggedInUser();
        setLoggedInUser(user);
      } catch (error) {
        console.error(error);
      }
    }
    fetchLoggedInUser();
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div>
        <NavBar
          loggedInUser={loggedInUser}
          onLoginClicked={() => setShowLoginModal(true)}
          onSignUpClicked={() => setShowSignUpModal(true)}
          onLogoutSuccessful={() => setLoggedInUser(null)}
        />
        <div className={styles.pageContainer}>
          <Routes>
            <Route
              path="/"
              element={<RecipesPage loggedInUser={loggedInUser} />}
            />
            <Route path="/privacy" element={<PrivacyPage />} />

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
        {showSignUpModal && (
          <SignUpModal
            onDismiss={() => setShowSignUpModal(false)}
            onSignUpSuccessful={(user) => {
              setLoggedInUser(user);
              setShowSignUpModal(false);
            }}
          />
        )}

        {showLoginModal && (
          <LoginModal
            onDismiss={() => setShowLoginModal(false)}
            onLoginSuccessful={(user) => {
              setLoggedInUser(user);
              setShowLoginModal(false);
            }}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
