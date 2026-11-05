// Ecrans reserves aux visiteurs (connexion, inscription) : connecte, on va a l'accueil.
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";

import { Skeleton } from "../../ui/display.tsx";
import { meQuery } from "./queries.ts";

export function GuestOnly() {
  const me = useQuery(meQuery);
  if (me.isPending) return <Skeleton label="Chargement de la session" />;
  return me.data ? <Navigate to="/" replace /> : <Outlet />;
}
