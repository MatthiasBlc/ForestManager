// Rendu de test avec les vrais fournisseurs et un routeur en memoire.
import { render, type RenderResult } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { Providers } from "../app/providers.tsx";
import { createQueryClient } from "../lib/query.ts";

export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: { route?: string } = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup>; client: QueryClient } {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  const user = userEvent.setup();
  const result = render(
    <Providers client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Providers>
  );
  return { ...result, user, client };
}
