// Racine d'une session : dernier espace visite s'il est encore la, sinon l'espace perso,
// et derniere entree visitee de cet espace (D60).
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";

import { Skeleton } from "../../ui/display.tsx";
import { readLastSection, readLastSpace } from "./last-space.ts";
import { meQuery, spacesQuery } from "./queries.ts";

export function HomeRedirect() {
  const me = useQuery(meQuery);
  const spaces = useQuery(spacesQuery);
  if (!me.data || spaces.isPending) return <Skeleton />;
  const last = readLastSpace();
  const target =
    last && spaces.data?.some((s) => s.id === last && !s.deletedAt)
      ? last
      : me.data.personalSpaceId;
  // L'entree memorisee est verifiee par l'espace (elle a pu disparaitre).
  return <Navigate to={`/s/${target}`} replace state={{ resume: readLastSection(target) }} />;
}
