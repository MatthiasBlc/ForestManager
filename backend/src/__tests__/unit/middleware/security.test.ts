import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";

// On importe directement le module pour eviter les problemes d'env
// requireHttps est le seul qu'on peut tester en detail facilement

describe("security middleware", () => {
  describe("requireHttps", () => {
    // On reimporte a chaque test pour controler NODE_ENV
    it("should call next() in non-production env", async () => {
      const { requireHttps } = await import("../../../middleware/security");
      const req = {
        headers: { "x-forwarded-proto": "http" },
      } as unknown as Request;
      const res = { redirect: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireHttps(req, res, next);
      // En test, NODE_ENV !== "production", donc next() est appele
      expect(next).toHaveBeenCalled();
    });

    it("should call next() when no x-forwarded-proto header", async () => {
      const { requireHttps } = await import("../../../middleware/security");
      const req = { headers: {} } as unknown as Request;
      const res = { redirect: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireHttps(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("authRateLimiter", () => {
    it("should be a passthrough in test environment", async () => {
      const { authRateLimiter } = await import("../../../middleware/security");
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      authRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("helmetMiddleware", () => {
    it("should exist and be a function", async () => {
      const { helmetMiddleware } = await import("../../../middleware/security");
      expect(typeof helmetMiddleware).toBe("function");
    });
  });

  describe("adminRateLimiter", () => {
    it("should exist and be a function", async () => {
      const { adminRateLimiter } = await import("../../../middleware/security");
      expect(typeof adminRateLimiter).toBe("function");
    });
  });
});
