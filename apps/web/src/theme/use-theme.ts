import { useQuery } from "@tanstack/react-query";

import { meQuery } from "../core/session/queries.ts";
import { useSystemDark } from "./system-dark.ts";
import { resolveTheme, type Theme } from "./themes.ts";

/** Theme courant (pour nommer les teintes de l'ambiance, par exemple). */
export function useTheme(): Theme {
  const me = useQuery(meQuery);
  return resolveTheme(me.data?.preferences ?? null, useSystemDark());
}
