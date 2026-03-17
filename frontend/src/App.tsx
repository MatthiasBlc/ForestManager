import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import BottomTabBar from "./components/mobile/BottomTabBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SocketProvider } from "./contexts/SocketContext";
import { BrowserRouter, Routes, useLocation } from "react-router-dom";
import { useIsMobile } from "./hooks/useIsMobile";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const { user } = useAuth();
  const isMobile = useIsMobile();

  return isAdmin ? (
    <>
      <ErrorBoundary>
        <Routes>{adminRoutes}</Routes>
      </ErrorBoundary>
      <Toaster position="top-right" />
    </>
  ) : (
    <div className="min-h-screen flex flex-col">
      <div className={user && isMobile ? "hidden" : ""}>
        <NavBar />
      </div>
      <ErrorBoundary>
        <div className="flex-1 flex flex-col">
          <Routes>{userRoutes}</Routes>
        </div>
      </ErrorBoundary>
      {user && isMobile && <BottomTabBar />}
      <LoginModal />
      <Toaster
        position={isMobile ? "bottom-center" : "top-right"}
        containerStyle={isMobile ? { bottom: 72 } : undefined}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SocketProvider>
            <AppContent />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
