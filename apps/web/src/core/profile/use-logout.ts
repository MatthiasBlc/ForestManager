import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { clearAccountStorage } from "../../lib/account-storage.ts";
import { api } from "../../lib/api.ts";

/** Ferme la session : cache et donnees du compte vides, retour a l'accueil public. */
export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await api.post("/auth/logout");
    queryClient.clear();
    clearAccountStorage();
    queryClient.setQueryData(["me"], null);
    void navigate("/", { replace: true });
  };
}
