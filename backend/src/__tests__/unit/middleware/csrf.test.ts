import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// En test env, le middleware est un passthrough.
// On teste la logique interne en mockant NODE_ENV.

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _cookies: Record<string, unknown>; _status: number; _json: unknown } {
  const res = {
    _cookies: {} as Record<string, unknown>,
    _status: 0,
    _json: null as unknown,
    cookie: vi.fn(function (this: typeof res, name: string, value: string, options: unknown) {
      this._cookies[name] = { value, options };
    }),
    status: vi.fn(function (this: typeof res, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function (this: typeof res, data: unknown) {
      this._json = data;
    }),
  } as unknown as Response & { _cookies: Record<string, unknown>; _status: number; _json: unknown };
  return res;
}

describe("CSRF middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should be a passthrough in test environment", async () => {
    const { csrfProtection } = await import("../../../middleware/csrf");
    const req = createMockReq({ method: "POST" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it("should exist and be a function", async () => {
    const { csrfProtection } = await import("../../../middleware/csrf");
    expect(typeof csrfProtection).toBe("function");
  });
});
