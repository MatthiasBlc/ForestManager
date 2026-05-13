import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const API_URL = import.meta.env.VITE_BACKEND_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // CSRF: lire le cookie XSRF-TOKEN et l'envoyer dans le header
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (match) {
    headers["X-XSRF-TOKEN"] = decodeURIComponent(match[1]);
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { data: undefined as T };
  }

  const data = await res.json();
  return { data };
}

export const API = {
  get: <T = any>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T = any>(path: string, body?: string) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T = any>(path: string, body?: string) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T = any>(path: string, body?: string) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T = any>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

export function buildQueryString(
  params: Record<string, string | number | string[] | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length > 0) searchParams.set(key, val.join(","));
    } else {
      searchParams.set(key, val.toString());
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function handleApiError(error: ApiError | Error): never {
  if (!(error instanceof ApiError)) {
    throw new Error("Network error - please check your connection");
  }
  if (error.status === 401) {
    throw new UnauthorizedError(error.message || "Unauthorized");
  }
  if (error.status === 409) {
    throw new ConflictError(error.message || "Conflict");
  }
  throw new Error(error.message || `Request failed (${error.status})`);
}

export function handleApiErrorWith(
  overrides: Record<number, string | typeof ConflictError | typeof UnauthorizedError>
): (error: ApiError | Error) => never {
  return (error: ApiError | Error) => {
    if (error instanceof ApiError) {
      const override = overrides[error.status];
      if (override) {
        if (override === ConflictError) throw new ConflictError(error.message || "Conflict");
        if (override === UnauthorizedError)
          throw new UnauthorizedError(error.message || "Unauthorized");
        throw new Error(override as string);
      }
    }
    return handleApiError(error);
  };
}
