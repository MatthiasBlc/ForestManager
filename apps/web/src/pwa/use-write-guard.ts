// Hors ligne, les actions d'ecriture sont desactivees, pas masquees, et renvoient
// au bandeau qui donne la raison (D106, D117). Le client API refuse de toute facon
// une ecriture sans reseau (D159).
import { useOnline } from "./use-online.ts";

export const OFFLINE_REASON_ID = "fm-offline-reason";

export interface WriteGuard {
  disabled?: boolean;
  "aria-describedby"?: string;
}

/** A etaler sur un bouton d'ecriture : `<Button {...guard}>`. */
export function useWriteGuard(): WriteGuard {
  const online = useOnline();
  return online ? {} : { disabled: true, "aria-describedby": OFFLINE_REASON_ID };
}
