import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  requireSuperAdmin,
  requireAdminSession,
} from "../../../admin/middleware/requireSuperAdmin";

function mockReqResNext(sessionData: Record<string, unknown> = {}) {
  const req = { session: { ...sessionData } } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("requireSuperAdmin", () => {
  it("should call next() when adminId and totpVerified are set", () => {
    const { req, res, next } = mockReqResNext({
      adminId: "admin-1",
      totpVerified: true,
    });
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("should return ADMIN_001 when adminId is missing", () => {
    const { req, res, next } = mockReqResNext({});
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining("ADMIN_001"),
      })
    );
  });

  it("should return ADMIN_002 when totpVerified is false", () => {
    const { req, res, next } = mockReqResNext({
      adminId: "admin-1",
      totpVerified: false,
    });
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining("ADMIN_002"),
      })
    );
  });

  it("should return ADMIN_002 when totpVerified is undefined", () => {
    const { req, res, next } = mockReqResNext({
      adminId: "admin-1",
    });
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining("ADMIN_002"),
      })
    );
  });
});

describe("requireAdminSession", () => {
  it("should call next() when adminId is set", () => {
    const { req, res, next } = mockReqResNext({ adminId: "admin-1" });
    requireAdminSession(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("should return 401 when adminId is missing", () => {
    const { req, res, next } = mockReqResNext({});
    requireAdminSession(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining("ADMIN_001"),
      })
    );
  });
});
