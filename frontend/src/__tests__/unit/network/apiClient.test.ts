import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError, handleApiError, handleApiErrorWith } from "../../../network/apiClient";
import { UnauthorizedError, ConflictError } from "../../../errors/http_errors";
import APIManager from "../../../network/api";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/mswServer";

const BACKEND_URL = "http://localhost:3001";

// ==========================================
// 5a — apiFetch
// ==========================================

describe("apiFetch", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends credentials: include on every request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await apiFetch("/api/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("prefixes URL with VITE_BACKEND_URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await apiFetch("/api/test");
    expect(mockFetch).toHaveBeenCalledWith(`${BACKEND_URL}/api/test`, expect.anything());
  });

  it("sends Content-Type: application/json header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await apiFetch("/api/test");
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("reads XSRF-TOKEN cookie and injects into X-XSRF-TOKEN header", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("XSRF-TOKEN=test-csrf-token");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await apiFetch("/api/test");
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-XSRF-TOKEN"]).toBe("test-csrf-token");
  });

  it("does not crash if XSRF-TOKEN cookie is absent", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await expect(apiFetch("/api/test")).resolves.toBeDefined();
  });

  it("throws ApiError with correct status and message on status >= 400", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({ error: "Not found" }),
    });
    let caughtError: unknown;
    try {
      await apiFetch("/api/test");
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(ApiError);
    expect((caughtError as ApiError).status).toBe(404);
    expect((caughtError as ApiError).message).toBe("Not found");
  });

  it("returns { data } parsed as JSON on 2xx status", async () => {
    const payload = { id: "1", name: "test" };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => payload,
    });
    const result = await apiFetch<typeof payload>("/api/test");
    expect(result).toEqual({ data: payload });
  });

  it("returns { data: undefined } on 204 without calling .json()", async () => {
    const jsonSpy = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: jsonSpy,
    });
    const result = await apiFetch("/api/test");
    expect(result).toEqual({ data: undefined });
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

// ==========================================
// 5b — handleApiError / handleApiErrorWith
// ==========================================

describe("handleApiError", () => {
  it("throws UnauthorizedError on 401", () => {
    const error = new ApiError(401, "Unauthorized");
    expect(() => handleApiError(error)).toThrow(UnauthorizedError);
  });

  it("throws ConflictError on 409", () => {
    const error = new ApiError(409, "Conflict");
    expect(() => handleApiError(error)).toThrow(ConflictError);
  });

  it("throws generic Error on other status with body message", () => {
    const error = new ApiError(500, "Internal server error");
    let caughtError: unknown;
    try {
      handleApiError(error);
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).not.toBeInstanceOf(UnauthorizedError);
    expect(caughtError).not.toBeInstanceOf(ConflictError);
    expect((caughtError as Error).message).toBe("Internal server error");
  });

  it("throws Error with 'Network error' message if not an ApiError", () => {
    const networkError = new Error("fetch failed");
    expect(() => handleApiError(networkError as unknown as ApiError)).toThrow(/Network error/);
  });
});

describe("handleApiErrorWith", () => {
  it("applies override message on specified status", () => {
    const handler = handleApiErrorWith({ 422: "Validation error" });
    const error = new ApiError(422, "some server error");
    expect(() => handler(error as never)).toThrow("Validation error");
  });

  it("falls back to handleApiError if status not overridden", () => {
    const handler = handleApiErrorWith({ 422: "Validation error" });
    const error = new ApiError(401, "Unauthorized");
    expect(() => handler(error as never)).toThrow(UnauthorizedError);
  });
});

// ==========================================
// 5c — removeMember 410 case
// ==========================================

describe("APIManager.removeMember — 410 case", () => {
  it("returns result without throwing on 410 status", async () => {
    server.use(
      http.delete(`${BACKEND_URL}/api/communities/:communityId/members/:userId`, () =>
        HttpResponse.json({ error: "Community deleted" }, { status: 410 })
      )
    );
    await expect(APIManager.removeMember("community-id", "user-id")).resolves.toBeDefined();
  });
});
