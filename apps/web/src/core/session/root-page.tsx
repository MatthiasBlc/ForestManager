// Racine : accueil public sans session, sinon le dernier espace visite.
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "../../ui/display.tsx";
import { PublicHome } from "../access/public-home.tsx";
import { HomeRedirect } from "./home-redirect.tsx";
import { meQuery } from "./queries.ts";

export function RootPage() {
  const me = useQuery(meQuery);
  if (me.isPending) return <Skeleton label="Chargement de la session" />;
  return me.data ? <HomeRedirect /> : <PublicHome />;
}
