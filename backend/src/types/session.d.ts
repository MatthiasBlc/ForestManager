import "express-session";

declare module "express-session" {
  interface SessionData {
    // User session
    userId?: string;
    
    // Admin session (utilise sur routes /api/admin/*)
    adminId?: string;
    totpVerified?: boolean;
    totpAttempts?: number;
  }
}
