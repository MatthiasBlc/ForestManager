// Accueil a widgets : un appel par ecran [D193].
import { homeResponseSchema } from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const homeQuery = queryOptions({
  queryKey: ["me", "home"],
  queryFn: () => api.get("/me/home", homeResponseSchema),
});
