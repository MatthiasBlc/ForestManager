// Ecran maintenu allume (D35) par l'API Wake Lock. Le navigateur relache le verrou
// quand la page passe en arriere-plan : on le redemande au retour.
import { useEffect, useState } from "react";

interface Sentinel {
  release: () => Promise<void>;
}

interface WakeLockApi {
  request: (type: "screen") => Promise<Sentinel>;
}

function wakeLockApi(): WakeLockApi | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

/** Vrai tant que l'ecran est maintenu allume ; faux si le navigateur ne le permet pas. */
export function useWakeLock(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const api = wakeLockApi();
    if (!api) return;
    let sentinel: Sentinel | null = null;
    let active = true;
    const acquire = async () => {
      try {
        const lock = await api.request("screen");
        if (!active) {
          void lock.release();
          return;
        }
        sentinel = lock;
        setHeld(true);
      } catch {
        // Refus (batterie faible, page cachee) : la page reste utilisable.
        setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, []);
  return held;
}
