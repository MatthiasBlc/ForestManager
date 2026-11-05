// Bandeau hors ligne (D68, D106) : la lecture continue, les ecritures echouent
// tout de suite avec un message clair (D35 : pas de file d'attente).
import { Icon } from "../ui/icon.tsx";
import { useOnline } from "./use-online.ts";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fm-root flex items-center gap-2 bg-warning-soft px-4 py-2 text-warning-text"
    >
      <Icon name="wifi-off" size={16} />
      <span>
        Hors ligne. Tu consultes la dernière version enregistrée ; les modifications attendront le
        réseau.
      </span>
    </div>
  );
}
