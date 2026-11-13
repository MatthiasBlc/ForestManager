// Connexion avec Discord [D202, D210] : boutons, E-INSCRIPTION-DISCORD, profil
// d'un compte sans mot de passe, liaison et suppression par le nom.
import { errorBody } from "@fm/shared";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

const START = "/api/v1/auth/discord/start";

describe("boutons Discord (E-CONNEXION, E-INSCRIPTION)", () => {
  it("absents si Discord n'est pas configure", async () => {
    mockSession({ me: null, discord: false });
    renderWithProviders(<App />, { route: "/login" });
    await screen.findByRole("button", { name: "Se connecter" });
    expect(screen.queryByRole("link", { name: "Continuer avec Discord" })).not.toBeInTheDocument();
  });

  it("connexion : garde la destination et suit Rester connecte", async () => {
    mockSession({ me: null, discord: true });
    const { user } = renderWithProviders(<App />, { route: "/login?next=%2Fjoin%2Fabc" });
    const link = await screen.findByRole("link", { name: "Continuer avec Discord" });
    expect(link).toHaveAttribute("href", `${START}?intent=login&next=%2Fjoin%2Fabc`);
    await user.click(screen.getByRole("switch", { name: "Rester connecté" }));
    expect(link).toHaveAttribute("href", `${START}?intent=login&next=%2Fjoin%2Fabc&remember=true`);
  });

  it("inscription : meme bouton", async () => {
    mockSession({ me: null, discord: true });
    renderWithProviders(<App />, { route: "/register" });
    expect(await screen.findByRole("link", { name: "Continuer avec Discord" })).toHaveAttribute(
      "href",
      `${START}?intent=login`
    );
  });

  it("retour en echec de Discord : message sur l'ecran de connexion", async () => {
    mockSession({ me: null, discord: true });
    renderWithProviders(<App />, { route: "/login?error=AUTH_015" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La connexion avec Discord a échoué ou a expiré. Réessayez."
    );
  });
});

describe("E-INSCRIPTION-DISCORD", () => {
  function pending(over: object = {}) {
    const bodies: unknown[] = [];
    mockSession({ me: null, discord: true, email: false });
    server.use(
      http.get("/api/v1/auth/discord/pending", () =>
        HttpResponse.json({
          username: "lea_martin",
          email: "lea@exemple.fr",
          emailVerified: true,
          discordUsername: "lea.martin",
          ...over,
        })
      ),
      http.post("/api/v1/auth/discord/register", async ({ request }) => {
        const body = (await request.json()) as { username: string; email: string };
        bodies.push(body);
        if (body.email === "pris@exemple.fr")
          return HttpResponse.json(errorBody("AUTH_004"), { status: 409 });
        const me = buildMe({ username: body.username, email: body.email, hasPassword: false });
        server.use(http.get("/api/v1/me", () => HttpResponse.json(me)));
        return HttpResponse.json(me, { status: 201 });
      })
    );
    return bodies;
  }

  it("propose le nom et l'email verifie, cree le compte puis accueille", async () => {
    const bodies = pending();
    const { user } = renderWithProviders(<App />, { route: "/register/discord" });
    expect(await screen.findByRole("heading", { name: "Créer ton compte" })).toBeInTheDocument();
    expect(screen.getByText("lea.martin")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveValue("lea_martin");
    expect(screen.getByLabelText("Adresse e-mail")).toHaveValue("lea@exemple.fr");
    expect(screen.getByText("Vérifiée")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connecte-toi avec ton mot de passe" })
    ).toHaveAttribute("href", "/login");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(
      await screen.findByRole("heading", { name: "Bienvenue, lea_martin" })
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ username: "lea_martin", email: "lea@exemple.fr" }]);
  });

  it("email change : plus marque verifie ; email deja pris sur son champ", async () => {
    pending();
    const { user } = renderWithProviders(<App />, { route: "/register/discord" });
    const email = await screen.findByLabelText("Adresse e-mail");
    await user.clear(email);
    await user.type(email, "pris@exemple.fr");
    expect(screen.queryByText("Vérifiée")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Adresse e-mail")).toHaveAccessibleDescription(/déjà utilisée/);
    });
  });

  it("sans email Discord verifie : champ vide a remplir", async () => {
    pending({ email: null, emailVerified: false });
    renderWithProviders(<App />, { route: "/register/discord" });
    expect(await screen.findByLabelText("Adresse e-mail")).toHaveValue("");
    expect(screen.queryByText("Vérifiée")).not.toBeInTheDocument();
  });

  it("attente expiree : message et retour a la connexion", async () => {
    mockSession({ me: null, discord: true });
    server.use(
      http.get("/api/v1/auth/discord/pending", () =>
        HttpResponse.json(errorBody("AUTH_015"), { status: 400 })
      )
    );
    renderWithProviders(<App />, { route: "/register/discord" });
    expect(await screen.findByText(/a échoué ou a expiré/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});

describe("profil et Discord", () => {
  it("compte sans mot de passe : encart de secours, Delier refuse avec explication", async () => {
    mockSession({
      me: buildMe({ hasPassword: false, discord: { username: "lea.martin" } }),
      discord: true,
    });
    server.use(
      http.delete("/api/v1/me/discord", () =>
        HttpResponse.json(errorBody("AUTH_017"), { status: 409 })
      )
    );
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    expect(await screen.findByText("Ajoute un mot de passe de secours")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Définir un mot de passe" })).toHaveAttribute(
      "href",
      "/profile/password"
    );
    expect(screen.getByText("Relié à lea.martin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Délier" }));
    expect(await screen.findByText("Définissez d'abord un mot de passe.")).toBeInTheDocument();
  });

  it("compte classique : pas d'encart, Relier mene a Discord ; retour avec message", async () => {
    mockSession({ me: buildMe(), discord: true });
    renderWithProviders(<App />, { route: "/profile?discord=linked" });
    expect(await screen.findByRole("link", { name: "Relier" })).toHaveAttribute(
      "href",
      `${START}?intent=link`
    );
    expect(screen.queryByText("Ajoute un mot de passe de secours")).not.toBeInTheDocument();
    expect(await screen.findByText("Compte Discord relié")).toBeInTheDocument();
  });

  it("liaison refusee : message du code", async () => {
    mockSession({ me: buildMe(), discord: true });
    renderWithProviders(<App />, { route: "/profile?discordError=AUTH_016" });
    expect(
      await screen.findByText("Ce compte Discord est déjà relié à un autre compte.")
    ).toBeInTheDocument();
  });

  it("delie un compte qui a un mot de passe", async () => {
    let me = buildMe({ discord: { username: "sam.d" } });
    mockSession({ me, discord: true });
    server.use(
      http.get("/api/v1/me", () => HttpResponse.json(me)),
      http.delete("/api/v1/me/discord", () => {
        me = { ...me, discord: null };
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    await user.click(await screen.findByRole("button", { name: "Délier" }));
    expect(await screen.findByRole("link", { name: "Relier" })).toBeInTheDocument();
  });

  it("sans Discord configure ni compte relie : pas de ligne Discord", async () => {
    mockSession({ me: buildMe(), discord: false });
    renderWithProviders(<App />, { route: "/profile" });
    await screen.findByRole("button", { name: "Se déconnecter" });
    expect(screen.queryByText("Compte Discord")).not.toBeInTheDocument();
  });
});

describe("compte sans mot de passe", () => {
  it("definit un mot de passe sans l'actuel", async () => {
    let me = buildMe({ hasPassword: false });
    mockSession({ me });
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/v1/me", () => HttpResponse.json(me)),
      http.put("/api/v1/me/password", async ({ request }) => {
        bodies.push(await request.json());
        me = { ...me, hasPassword: true };
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: "/profile/password" });
    expect(await screen.findByText(/te servira de secours/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "un-secours-solide");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/Mot de passe enregistré/)).toBeInTheDocument();
    expect(bodies).toEqual([{ newPassword: "un-secours-solide" }]);
  });

  it("l'adresse e-mail ne change qu'apres avoir defini un mot de passe", async () => {
    mockSession({ me: buildMe({ hasPassword: false }) });
    renderWithProviders(<App />, { route: "/profile/account" });
    expect(await screen.findByLabelText("Adresse e-mail")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Définis d'abord un mot de passe" })).toHaveAttribute(
      "href",
      "/profile/password"
    );
  });

  it("supprime le compte en tapant son nom", async () => {
    const me = buildMe({ username: "lea_martin", hasPassword: false });
    mockSession({ me });
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/v1/me/deletion-preview", () => HttpResponse.json({ spaces: [] })),
      http.delete("/api/v1/me", async ({ request }) => {
        bodies.push(await request.json());
        server.use(
          http.get("/api/v1/me", () => HttpResponse.json(errorBody("AUTH_001"), { status: 401 }))
        );
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = renderWithProviders(<App />, { route: "/profile/delete" });
    const confirm = await screen.findByLabelText(
      "Pour confirmer, tape ton nom d'utilisateur : lea_martin"
    );
    const button = screen.getByRole("button", { name: "Supprimer définitivement mon compte" });
    expect(screen.queryByLabelText("Mot de passe")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    await user.type(confirm, "lea_martin");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(await screen.findByText("Ton compte a été supprimé")).toBeInTheDocument();
    expect(bodies).toEqual([{ username: "lea_martin" }]);
  });
});
