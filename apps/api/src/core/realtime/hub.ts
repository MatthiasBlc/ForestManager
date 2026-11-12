// Diffusion temps reel en memoire (une seule instance d'API) [D188]. Les
// appelants ne connaissent que cette interface : passer a PostgreSQL
// LISTEN/NOTIFY plus tard ne les touchera pas.
import type { RealtimeEvent } from "@fm/shared";

export interface Connection {
  send: (event: RealtimeEvent) => void;
  /** Ferme la connexion (trop de connexions, arret du serveur). */
  end: () => void;
}

export interface Realtime {
  /** Intervalle du battement du flux SSE (et du controle de la session). */
  readonly heartbeatMs: number;
  /** Enregistre une connexion ; renvoie la fonction qui l'oublie. */
  connect: (userId: string, connection: Connection) => () => void;
  toUsers: (userIds: readonly string[], event: RealtimeEvent) => void;
  closeAll: () => void;
}

/** Au-dela, la plus ancienne connexion de l'utilisateur est fermee. */
const MAX_CONNECTIONS_PER_USER = 10;

export function createRealtime(options: { heartbeatMs?: number } = {}): Realtime {
  const byUser = new Map<string, Set<Connection>>();

  const forget = (userId: string, connection: Connection) => {
    const set = byUser.get(userId);
    if (!set) return;
    set.delete(connection);
    if (set.size === 0) byUser.delete(userId);
  };

  return {
    heartbeatMs: options.heartbeatMs ?? 25_000,
    connect(userId, connection) {
      const set = byUser.get(userId) ?? new Set<Connection>();
      byUser.set(userId, set);
      set.add(connection);
      if (set.size > MAX_CONNECTIONS_PER_USER) {
        const [oldest] = set;
        if (oldest) {
          forget(userId, oldest);
          oldest.end();
        }
      }
      return () => {
        forget(userId, connection);
      };
    },
    toUsers(userIds, event) {
      for (const userId of new Set(userIds)) {
        for (const connection of byUser.get(userId) ?? []) connection.send(event);
      }
    },
    closeAll() {
      for (const set of byUser.values()) for (const connection of set) connection.end();
      byUser.clear();
    },
  };
}
