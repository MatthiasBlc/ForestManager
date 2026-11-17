// Suivi d'erreurs [D75, D196] : client Sentry (`@sentry/core`, sans
// l'instrumentation automatique de `@sentry/node`) qui envoie a Bugsink par le
// DSN de l'environnement. Seules les erreurs 5xx et les rejets non geres
// partent ; aucune donnee personnelle : ni requete, ni cookies, ni IP,
// l'utilisateur n'est qu'un UUID. Le tunnel du navigateur passe aussi par ici.
import {
  createEnvelope,
  createStackParser,
  createTransport,
  dedupeIntegration,
  getEnvelopeEndpointWithUrlEncodedAuth,
  linkedErrorsIntegration,
  makeDsn,
  Scope,
  serializeEnvelope,
  uuid4,
  type Event,
  type EventEnvelope,
} from "@sentry/core";
import { nodeStackLineParser, ServerRuntimeClient } from "@sentry/core/server";

import { APP_VERSION } from "../changelog/version.ts";
import type { Env } from "../config/env.ts";

/** Delai maximal d'un envoi au recepteur. */
const SEND_TIMEOUT_MS = 5000;

export interface ErrorContext {
  userId?: string | undefined;
  requestId?: string | undefined;
}

export interface ErrorTracking {
  /** Hote du recepteur ("bugsink.example.org"), jamais la cle. */
  host: string;
  environment: string;
  release: string;
  captureException(error: unknown, context?: ErrorContext): void;
  /**
   * Tunnel : relaie une enveloppe du navigateur vers le vrai DSN (le front n'en
   * connait qu'un factice). Renvoie le statut HTTP du recepteur.
   */
  forward(envelope: string): Promise<number>;
  /** Evenement de test d'A13 ; renvoie le statut HTTP du recepteur. */
  sendTest(): Promise<number>;
  /** Attend la fin des envois en cours (arret, tests). */
  flush(timeoutMs: number): Promise<boolean>;
}

/** Retire de l'evenement tout ce qui pourrait identifier une personne. */
function scrub<E extends Event>(event: E): E {
  delete event.request;
  delete event.server_name;
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  if (event.user && Object.keys(event.user).length === 0) delete event.user;
  return event;
}

/** Client du suivi, ou null sans SENTRY_DSN. Un DSN illisible arrete le demarrage. */
export function createErrorTracking(env: Env): ErrorTracking | null {
  if (!env.SENTRY_DSN) return null;
  const dsn = makeDsn(env.SENTRY_DSN);
  if (!dsn?.publicKey || !dsn.projectId) throw new Error("SENTRY_DSN is not a valid Sentry DSN");
  const realDsn = env.SENTRY_DSN;
  const endpoint = getEnvelopeEndpointWithUrlEncodedAuth(dsn);
  const environment = env.SENTRY_ENVIRONMENT ?? env.NODE_ENV;
  const release = APP_VERSION;

  const post = async (body: string | Uint8Array): Promise<number> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.status;
  };

  const client = new ServerRuntimeClient({
    dsn: realDsn,
    release,
    environment,
    // Rien de personnel : ni cookies, ni en-tetes, ni corps, ni parametres d'URL.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    platform: "node",
    runtime: { name: "node", version: process.version },
    stackParser: createStackParser(nodeStackLineParser()),
    integrations: [linkedErrorsIntegration(), dedupeIntegration()],
    transport: (options) =>
      createTransport(options, async (request) => ({ statusCode: await post(request.body) })),
    beforeSend: scrub,
  });
  client.init();

  return {
    host: dsn.port ? `${dsn.host}:${dsn.port}` : dsn.host,
    environment,
    release,
    captureException(error, context = {}) {
      const scope = new Scope();
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.requestId) scope.setTag("request_id", context.requestId);
      client.captureException(error, undefined, scope);
    },
    forward(envelope) {
      const header = envelopeHeader(envelope);
      if (!header) return Promise.reject(new Error("unreadable envelope header"));
      const newline = envelope.indexOf("\n");
      const rest = newline === -1 ? "" : envelope.slice(newline);
      return post(JSON.stringify({ ...header, dsn: realDsn }) + rest);
    },
    sendTest() {
      const event: Event = {
        event_id: uuid4(),
        timestamp: Date.now() / 1000,
        platform: "node",
        level: "info",
        message: "Forest Manager : événement de test envoyé depuis les réglages (A13)",
        release,
        environment,
      };
      const envelope = createEnvelope<EventEnvelope>(
        { event_id: event.event_id ?? uuid4(), sent_at: new Date().toISOString(), dsn: realDsn },
        [[{ type: "event" }, event]]
      );
      return post(serializeEnvelope(envelope));
    },
    flush: async (timeoutMs) => client.flush(timeoutMs),
  };
}

/**
 * En-tete d'enveloppe lisible (premiere ligne : un objet JSON), sinon null.
 * Le tunnel refuse le reste sans appeler le recepteur.
 */
export function envelopeHeader(body: string): Record<string, unknown> | null {
  const newline = body.indexOf("\n");
  try {
    const parsed: unknown = JSON.parse(newline === -1 ? body : body.slice(0, newline));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
