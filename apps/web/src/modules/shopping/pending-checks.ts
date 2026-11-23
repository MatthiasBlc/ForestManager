// Coches faites sans reseau [D228] : gardees sur l'appareil par espace (prefixe "fm:",
// efface a la deconnexion), montrees par-dessus la liste en cache, envoyees au retour
// du reseau. La derniere coche d'un article remplace la precedente ; l'API ignore une
// coche plus ancienne que la sienne (`checkedChangedAt`), et un article retire
// entre-temps (erreur metier) fait oublier la coche.
import type { ShoppingItem } from "@fm/shared";
import { useSyncExternalStore } from "react";

import { api, isNetworkError } from "../../lib/api.ts";

export interface PendingCheck {
  checked: boolean;
  /** Moment de la coche, envoye comme `checkedChangedAt`. */
  at: string;
}

export type PendingChecks = Readonly<Record<string, PendingCheck>>;

const EMPTY: PendingChecks = {};
const storageKey = (spaceId: string) => `fm:shopping-checks:${spaceId}`;
const cache = new Map<string, PendingChecks>();
const listeners = new Set<() => void>();
const flushing = new Set<string>();

function read(spaceId: string): PendingChecks {
  const known = cache.get(spaceId);
  if (known) return known;
  let value: PendingChecks = EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(spaceId));
    if (raw) value = JSON.parse(raw) as PendingChecks;
  } catch {
    // Stockage indisponible ou illisible : rien en attente.
  }
  cache.set(spaceId, value);
  return value;
}

function write(spaceId: string, value: PendingChecks): void {
  cache.set(spaceId, value);
  try {
    if (Object.keys(value).length === 0) localStorage.removeItem(storageKey(spaceId));
    else localStorage.setItem(storageKey(spaceId), JSON.stringify(value));
  } catch {
    // Stockage indisponible : la coche reste en memoire jusqu'au rechargement.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Deconnexion (stockage vide par `clearAccountStorage`) : relu a la prochaine lecture.
  cache.clear();
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingChecks(spaceId: string): PendingChecks {
  return useSyncExternalStore(
    subscribe,
    () => read(spaceId),
    () => EMPTY
  );
}

export function queueCheck(spaceId: string, itemId: string, checked: boolean, at: string): void {
  write(spaceId, { ...read(spaceId), [itemId]: { checked, at } });
}

/** Oublie une coche envoyee, sauf si une plus recente l'a remplacee pendant l'envoi. */
function forget(spaceId: string, itemId: string, at: string): void {
  const current = read(spaceId);
  if (current[itemId]?.at !== at) return;
  const { [itemId]: _sent, ...rest } = current;
  write(spaceId, rest);
}

/** La liste vue sur l'appareil : coches en attente par-dessus celle du serveur. */
export function withPending(
  items: readonly ShoppingItem[],
  pending: PendingChecks
): ShoppingItem[] {
  return items.map((item) => {
    const check = pending[item.id];
    if (!check) return item;
    return { ...item, checkedAt: check.checked ? (item.checkedAt ?? check.at) : null };
  });
}

/**
 * Envoie les coches en attente, une a une ; s'arrete au premier echec reseau (elles
 * repartiront au prochain retour du reseau). Vrai si quelque chose a ete envoye.
 */
export async function flushChecks(spaceId: string): Promise<boolean> {
  if (flushing.has(spaceId)) return false;
  flushing.add(spaceId);
  let sent = false;
  try {
    for (;;) {
      const next = Object.entries(read(spaceId))[0];
      if (!next) break;
      const [itemId, { checked, at }] = next;
      try {
        await api.patch(`/spaces/${spaceId}/shopping/items/${itemId}`, {
          checked,
          checkedChangedAt: at,
        });
      } catch (error) {
        if (isNetworkError(error) || !navigator.onLine) break;
        // Erreur metier (article retire, droit retire) : la coche est oubliee.
      }
      forget(spaceId, itemId, at);
      sent = true;
    }
  } finally {
    flushing.delete(spaceId);
  }
  return sent;
}
