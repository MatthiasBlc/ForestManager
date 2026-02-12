import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireAuth } from "../../../middleware/auth";

function mockReqResNext(sessionData: Record<string, unknown> = {}) {
  const req = { session: { ...sessionData } } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("requireAuth", () => {
  it("should call next() when userId is in session", () => {
    const { req, res, next } = mockReqResNext({ userId: "user-1" });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("should call next with 401 error when userId is missing", () => {
    const { req, res, next } = mockReqResNext({});
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining("AUTH_001"),
      })
    );
  });

  it("should call next with 401 when session has no userId (undefined)", () => {
    const { req, res, next } = mockReqResNext({ userId: undefined });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 })
    );
  });

  it("should pass when userId is a valid string", () => {
    const { req, res, next } = mockReqResNext({ userId: "some-uuid" });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
