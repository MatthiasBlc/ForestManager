import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "../models/user";
import APIManager from "../network/api";
import { UnauthorizedError } from "../errors/http_errors";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  showLoginModal: boolean;
  login: (username: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Check if user is already authenticated on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const loggedInUser = await APIManager.getLoggedInUser();
        setUser(loggedInUser);
      } catch {
        // Not authenticated - this is expected
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    setError(null);
    try {
      const loggedInUser = await APIManager.login({ username, password });
      setUser(loggedInUser);
      setShowLoginModal(false);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed");
      }
      throw err;
    }
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const newUser = await APIManager.signUp({ username, email, password });
      setUser(newUser);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Sign up failed");
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await APIManager.logout();
    } catch {
      // Logout failure is non-critical - clear local state regardless
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const loggedInUser = await APIManager.getLoggedInUser();
      setUser(loggedInUser);
    } catch {
      setUser(null);
    }
  }, []);

  const openLoginModal = useCallback(() => {
    setError(null);
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setError(null);
    setShowLoginModal(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    showLoginModal,
    login,
    signUp,
    logout,
    refreshUser,
    openLoginModal,
    closeLoginModal,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
