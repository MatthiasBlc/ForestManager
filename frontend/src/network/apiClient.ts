import axios, { AxiosError } from "axios";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
export const API = axios.create({ withCredentials: true, baseURL: apiUrl });

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

API.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/json";

  // CSRF: lire le cookie XSRF-TOKEN et l'envoyer dans le header
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (match) {
    config.headers["X-XSRF-TOKEN"] = decodeURIComponent(match[1]);
  }

  return config;
});

// Utility function to handle API errors safely
export function handleApiError(error: AxiosError<{ error?: string }>): never {
  if (!error.response) {
    throw new Error("Network error - please check your connection");
  }
  if (error.response.status === 401) {
    throw new UnauthorizedError(error.response.data?.error || "Unauthorized");
  }
  if (error.response.status === 409) {
    throw new ConflictError(error.response.data?.error || "Conflict");
  }
  throw new Error(error.response.data?.error || `Request failed (${error.response.status})`);
}

// Custom error handler with status-specific fallback messages
export function handleApiErrorWith(
  overrides: Record<number, string | typeof ConflictError | typeof UnauthorizedError>
): (error: AxiosError<{ error?: string }>) => never {
  return (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status;
    const msg = error.response?.data?.error;

    if (status && overrides[status]) {
      const override = overrides[status];
      if (override === ConflictError) throw new ConflictError(msg || "Conflict");
      if (override === UnauthorizedError) throw new UnauthorizedError(msg || "Unauthorized");
      throw new Error(msg || (override as string));
    }

    return handleApiError(error);
  };
}
