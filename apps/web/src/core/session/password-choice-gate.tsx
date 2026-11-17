// Session ouverte par un mot de passe temporaire [D134] : l'API refuse tout le
// reste (AUTH_011), l'application n'affiche que le choix du nouveau mot de passe.
// L'administration (/admin) a sa propre session et n'est pas concernee.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { ChoosePasswordPage } from "../access/password-pages.tsx";
import { meQuery } from "./queries.ts";

export function PasswordChoiceGate({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery);
  const { pathname } = useLocation();
  if (me.data?.mustChoosePassword && !pathname.startsWith("/admin")) {
    return <ChoosePasswordPage />;
  }
  return children;
}
