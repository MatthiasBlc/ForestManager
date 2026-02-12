import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { AdminUser } from "../models/admin";
import APIManager from "../network/api";
import { UnauthorizedError } from "../errors/http_errors";

// Login step 1 result
interface LoginStep1Result {
  requiresTotpSetup: boolean;
  qrCode?: string;
}

// Auth state
type AuthStep = "idle" | "credentials" | "totp" | "authenticated";

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  authStep: AuthStep;
  qrCode: string | null;
  error: string | null;

  // Login flow
  loginStep1: (email: string, password: string) => Promise<LoginStep1Result>;
  loginStep2: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authStep, setAuthStep] = useState<AuthStep>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if admin is already authenticated on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const adminUser = await APIManager.getLoggedInAdmin();
        setAdmin(adminUser);
        setAuthStep("authenticated");
      } catch {
        // Not authenticated - this is expected
        setAdmin(null);
        setAuthStep("idle");
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Step 1: Email/password verification
  const loginStep1 = useCallback(async (email: string, password: string): Promise<LoginStep1Result> => {
    setError(null);
    try {
      const response = await APIManager.adminLogin(email, password);

      if (response.requiresTotpSetup && response.qrCode) {
        setQrCode(response.qrCode);
      } else {
        setQrCode(null);
      }

      setAuthStep("totp");
      return {
        requiresTotpSetup: response.requiresTotpSetup,
        qrCode: response.qrCode,
      };
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

  // Step 2: TOTP verification
  const loginStep2 = useCallback(async (code: string): Promise<void> => {
    setError(null);
    try {
      const response = await APIManager.adminVerifyTotp(code);
      setAdmin(response.admin);
      setAuthStep("authenticated");
      setQrCode(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("TOTP verification failed");
      }
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await APIManager.adminLogout();
    } catch {
      // Logout failure is non-critical - clear local state regardless
    } finally {
      setAdmin(null);
      setAuthStep("idle");
      setQrCode(null);
      setError(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AdminAuthContextType = {
    admin,
    isLoading,
    authStep,
    qrCode,
    error,
    loginStep1,
    loginStep2,
    logout,
    clearError,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}

export default AdminAuthContext;
