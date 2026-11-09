// Connexion par un mot de passe temporaire [D134] : rien d'autre avant d'en choisir un.
import { errorBody } from "@fm/shared";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildMe } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

const NEW_PASSWORD = "Une-phrase-de-passe-neuve-42";

describe("choisir son mot de passe apres un mot de passe temporaire", () => {
  it("bloque l'application puis l'ouvre une fois le mot de passe choisi", async () => {
    const me = buildMe({ mustChoosePassword: true });
    mockSession({ me });
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/v1/auth/choose-password", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ...me, mustChoosePassword: false });
      })
    );
    const { user, container } = renderWithProviders(<App />, { route: "/profile" });
    expect(
      await screen.findByRole("heading", { name: "Choisis ton mot de passe" })
    ).toBeInTheDocument();
    expect(screen.getByText(/mot de passe temporaire/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.type(screen.getByLabelText("Nouveau mot de passe"), NEW_PASSWORD);
    await user.type(screen.getByLabelText("Confirme-le"), "autre-chose-encore");
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByText("Les deux mots de passe ne sont pas identiques.")).toBeVisible();

    await user.clear(screen.getByLabelText("Confirme-le"));
    await user.type(screen.getByLabelText("Confirme-le"), NEW_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    await waitFor(() => {
      expect(bodies).toEqual([{ password: NEW_PASSWORD }]);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Choisis ton mot de passe" })
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/Mot de passe enregistré/)).toBeInTheDocument();
  });

  it("temporaire expire : retour a la connexion avec le message", async () => {
    mockSession({ me: buildMe({ mustChoosePassword: true }) });
    server.use(
      http.post("/api/v1/auth/choose-password", () => {
        // La session restreinte est fermee par l'API.
        mockSession({ me: null });
        return HttpResponse.json(errorBody("AUTH_014"), { status: 409 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: "/" });
    await user.type(await screen.findByLabelText("Nouveau mot de passe"), NEW_PASSWORD);
    await user.type(screen.getByLabelText("Confirme-le"), NEW_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByText(/n'est plus valable/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Connexion|Se connecter/ })).toBeVisible();
  });
});
