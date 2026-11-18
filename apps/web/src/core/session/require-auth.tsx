// Garde des routes connectees : sans session, renvoie vers la connexion en gardant la cible.
// Ouvre aussi le flux temps reel tant que la session existe, et retient la page
// visitee pour le retour des recettes (D219).
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router";

import { Skeleton } from "../../ui/display.tsx";
import { useRealtime } from "../realtime/use-realtime.ts";
import { useRememberPage } from "../shell/return-to.ts";
import { meQuery } from "./queries.ts";

export function RequireAuth() {
  const me = useQuery(meQuery);
  const location = useLocation();
  useRealtime(Boolean(me.data));
  useRememberPage();
  if (me.isPending) return <Skeleton label="Chargement de la session" />;
  if (!me.data) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
