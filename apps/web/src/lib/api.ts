// Client de l'API : meme origine (proxy Vite en dev, nginx en prod), cookies de
// session, jeton CSRF double submit sur les requetes mutantes, reponses validees
// contre les schemas partages, erreurs au format unique [D72].
import { API_PREFIX, apiErrorSchema } from "@fm/shared";
import type { z } from "zod";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "x-xsrf-token";

/** Erreur d'appel : code de l'API (`SPACE_001`...), ou `NETWORK` / `CONTRACT` cote client. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readCsrfCookie(): string | undefined {
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CSRF_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      if (value) return value;
    }
  }
  return undefined;
}

function url(path: string): string {
  return new URL(`${API_PREFIX}${path}`, window.location.origin).toString();
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") {
    let csrf = readCsrfCookie();
    if (!csrf) {
      // Premier appel mutant : /config pose le cookie CSRF.
      await send("GET", "/config");
      csrf = readCsrfCookie();
    }
    if (csrf) headers[CSRF_HEADER] = csrf;
  }
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    return await fetch(url(path), {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError("NETWORK", 0, "Connexion impossible. Vérifie ton réseau.");
  }
}

async function request<T extends z.ZodType | undefined>(
  method: string,
  path: string,
  body: unknown,
  schema: T
): Promise<T extends z.ZodType ? z.output<T> : undefined> {
  const res = await send(method, path, body);
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiRequestError(code, res.status, message, details);
    }
    throw new ApiRequestError("COMMON_001", res.status, "Une erreur inattendue est survenue.");
  }
  if (!schema) return undefined as never;
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiRequestError(
      "CONTRACT",
      res.status,
      "Réponse inattendue du serveur.",
      result.error
    );
  }
  return result.data as never;
}

export const api = {
  get: <T extends z.ZodType>(path: string, schema: T) => request("GET", path, undefined, schema),
  post: <T extends z.ZodType | undefined = undefined>(path: string, body?: unknown, schema?: T) =>
    request("POST", path, body, schema as T),
  patch: <T extends z.ZodType | undefined = undefined>(path: string, body?: unknown, schema?: T) =>
    request("PATCH", path, body, schema as T),
  put: <T extends z.ZodType | undefined = undefined>(path: string, body?: unknown, schema?: T) =>
    request("PUT", path, body, schema as T),
  delete: <T extends z.ZodType | undefined = undefined>(path: string, body?: unknown, schema?: T) =>
    request("DELETE", path, body, schema as T),
};
