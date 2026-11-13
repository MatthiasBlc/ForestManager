// Ecrans reserves aux visiteurs (connexion, inscription) : connecte, on va a la
// page demandee (`next`), sinon a l'accueil.
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useSearchParams } from "react-router";

import { safeNext } from "../../lib/form-errors.ts";
import { Skeleton } from "../../ui/display.tsx";
import { meQuery } from "./queries.ts";

export function GuestOnly() {
  const me = useQuery(meQuery);
  const [params] = useSearchParams();
  if (me.isPending) return <Skeleton label="Chargement de la session" />;
  return me.data ? <Navigate to={safeNext(params.get("next"))} replace /> : <Outlet />;
}
