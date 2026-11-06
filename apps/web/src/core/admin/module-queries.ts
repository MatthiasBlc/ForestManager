// Requetes admin des modules (C4.2). Cle "admin" : jamais persistee hors ligne.
import {
  adminModuleGrantSchema,
  adminModuleRequestsSchema,
  adminModuleSchema,
  listSchema,
  offsetPageSchema,
} from "@fm/shared";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api.ts";

export const moduleRequestsQuery = queryOptions({
  queryKey: ["admin", "module-requests"],
  queryFn: () => api.get("/admin/module-requests", adminModuleRequestsSchema),
});

export const adminModulesQuery = queryOptions({
  queryKey: ["admin", "modules"],
  queryFn: async () => (await api.get("/admin/modules", listSchema(adminModuleSchema))).data,
});

export function moduleGrantsQuery(code: string) {
  return queryOptions({
    queryKey: ["admin", "modules", code, "spaces"],
    queryFn: () =>
      api.get(`/admin/modules/${code}/spaces?limit=100`, offsetPageSchema(adminModuleGrantSchema)),
  });
}
