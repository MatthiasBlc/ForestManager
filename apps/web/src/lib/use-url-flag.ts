// Feuille ouverte par l'adresse (`?invite=1`, `?generate=1`) : la recherche
// globale y mene [D119]. `allowed` vaut undefined tant que le droit n'est pas
// connu ; refuse, le parametre est retire. Fermer la feuille le retire aussi.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

export function useUrlFlag(
  name: string,
  allowed: boolean | undefined
): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const flagged = params.get(name) === "1";
  const clear = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(name);
        return next;
      },
      { replace: true }
    );
  }, [name, setParams]);
  useEffect(() => {
    if (flagged && allowed === false) clear();
  }, [flagged, allowed, clear]);
  const set = (next: boolean) => {
    setOpen(next);
    if (!next && flagged) clear();
  };
  return [open || (flagged && allowed === true), set];
}
