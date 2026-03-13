import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import NavBar from "./components/Navbar/NavBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SocketProvider } from "./contexts/SocketContext";
import { BrowserRouter, Routes, useLocation } from "react-router-dom";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return isAdmin ? (
    <>
      <ErrorBoundary>
        <Routes>{adminRoutes}</Routes>
      </ErrorBoundary>
      <Toaster position="top-right" />
    </>
  ) : (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <ErrorBoundary>
        <div className="flex-1 flex flex-col">
          <Routes>{userRoutes}</Routes>
        </div>
      </ErrorBoundary>
      <LoginModal />
      <Toaster position="top-right" />
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
