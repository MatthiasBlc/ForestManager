// Bandeau hors ligne (D68, D106) : la lecture continue, les ecritures echouent
// tout de suite avec un message clair (D35 : pas de file d'attente, sauf les coches
// de la liste de courses, D228).
import { useMatch } from "react-router";

import { Icon } from "../ui/icon.tsx";
import { OFFLINE_REASON_ID } from "./use-write-guard.ts";
import { useOnline } from "./use-online.ts";

export function OfflineBanner() {
  const online = useOnline();
  // La liste de courses se coche hors ligne (D228) : le bandeau le dit sur sa page.
  const shopping = useMatch("/s/:spaceId/shopping");
  if (online) return null;
  return (
    <div
      role="status"
      className="fm-root flex items-center gap-2 bg-warning-soft px-4 py-2 text-warning-text"
    >
      <Icon name="wifi-off" size={16} />
      <span id={OFFLINE_REASON_ID}>
        {shopping
          ? "Hors ligne. Tu peux cocher la liste ; le reste attend le retour du réseau."
          : "Hors ligne. Tu consultes la dernière version enregistrée ; pour modifier, attends le retour du réseau."}
      </span>
    </div>
  );
}
