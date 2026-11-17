// Suivi d'erreurs du navigateur [D75, D196] : `@sentry/react` n'est charge que si
// l'API annonce `features.errorTracking`. Les envois passent par le tunnel de
// l'API (POST /api/v1/monitoring), qui remplace le DSN factice ci-dessous par
// le vrai : le front ne connait pas le DSN et la CSP ne change pas.
// Les erreurs non gerees et les rejets sont captes par les integrations par
// defaut du SDK ; l'utilisateur n'est qu'un UUID.
import { API_PREFIX } from "@fm/shared";
import type { BrowserOptions, ErrorEvent } from "@sentry/react";
import type { Query, QueryClient } from "@tanstack/react-query";

import { configQuery, meQuery } from "../core/session/queries.ts";

/** DSN factice : seule la forme compte, le tunnel le remplace. */
const TUNNEL_DSN = "https://forest@monitoring.invalid/1";

export interface SentryApi {
  init: (options: BrowserOptions) => unknown;
  setUser: (user: { id: string } | null) => void;
}

/** Retire de l'evenement tout ce qui pourrait identifier une personne. */
function scrub(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    if (event.user.id === undefined) delete event.user;
    else event.user = { id: event.user.id };
  }
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}

/**
 * Demarre le suivi si l'API l'annonce. Renvoie true s'il tourne. Ne leve
 * jamais : sans configuration lisible, l'application vit sans suivi.
 */
export async function startErrorTracking(
  client: QueryClient,
  load: () => Promise<SentryApi> = () => import("@sentry/react")
): Promise<boolean> {
  try {
    const config = await client.query(configQuery);
    if (!config.features.errorTracking) return false;
    const sentry = await load();
    sentry.init({
      dsn: TUNNEL_DSN,
      tunnel: `${API_PREFIX}/monitoring`,
      release: config.release,
      environment: config.environment,
      // Rien de personnel : ni cookies, ni en-tetes, ni corps, ni parametres d'URL.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      beforeSend: scrub,
    });
    const syncUser = () => {
      const me = client.getQueryData(meQuery.queryKey);
      sentry.setUser(me ? { id: me.id } : null);
    };
    syncUser();
    client.getQueryCache().subscribe((event) => {
      const { queryKey } = event.query as Query;
      if (event.type === "updated" && queryKey.length === 1 && queryKey[0] === "me") syncUser();
    });
    return true;
  } catch {
    return false;
  }
}
