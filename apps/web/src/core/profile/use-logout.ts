import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { api } from "../../lib/api.ts";

/** Ferme la session : cache vide, retour a l'accueil public. */
export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await api.post("/auth/logout");
    queryClient.clear();
    queryClient.setQueryData(["me"], null);
    void navigate("/", { replace: true });
  };
}
