import { errorBody, type Me } from "@fm/shared";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";

/** Serveur sans session au depart ; /auth/login et /auth/register ouvrent la session. */
function loggedOut({ email = true }: { email?: boolean } = {}) {
  let me: Me | null = null;
  const account = buildMe({ username: "matthias", emailVerified: false });
  const bodies: Record<string, unknown> = {};
  server.use(
    http.get("/api/v1/config", () => HttpResponse.json({ features: { email } })),
    http.get("/api/v1/me", () =>
      me ? HttpResponse.json(me) : HttpResponse.json(errorBody("AUTH_001"), { status: 401 })
    ),
    http.get("/api/v1/spaces", () =>
      HttpResponse.json({
        data: me ? [{ ...buildPersonalSpace(account), modules: undefined }] : [],
      })
    ),
    http.get("/api/v1/spaces/:id", () => HttpResponse.json(buildPersonalSpace(account))),
    http.post("/api/v1/auth/login", async ({ request }) => {
      bodies.login = await request.json();
      const { password } = bodies.login as { password: string };
      if (password !== "bon-mot-de-passe") {
        return HttpResponse.json(errorBody("AUTH_002"), { status: 401 });
      }
      me = account;
      return HttpResponse.json(me);
    }),
    http.post("/api/v1/auth/register", async ({ request }) => {
      bodies.register = await request.json();
      const { username } = bodies.register as { username: string };
      if (username === "pris") return HttpResponse.json(errorBody("AUTH_003"), { status: 409 });
      me = { ...account, username, email: (bodies.register as { email: string }).email };
      return HttpResponse.json(me, { status: 201 });
    }),
    http.post("/api/v1/auth/forgot-password", async ({ request }) => {
      bodies.forgot = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/v1/auth/reset-password", async ({ request }) => {
      bodies.reset = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/v1/auth/verify-email", async ({ request }) => {
      bodies.verify = await request.json();
      const { token } = bodies.verify as { token: string };
      return token.startsWith("bad")
        ? HttpResponse.json(errorBody("AUTH_008"), { status: 400 })
        : new HttpResponse(null, { status: 204 });
    })
  );
  return { bodies, account };
}

const TOKEN = "a".repeat(43);

describe("accueil public", () => {
  it("presente l'application et mene a l'inscription ou la connexion", async () => {
    loggedOut();
    renderWithProviders(<App />, { route: "/" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Forest Manager" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer un compte" })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
  });

  it("une page connectee renvoie vers la connexion en gardant la cible", async () => {
    loggedOut();
    renderWithProviders(<App />, { route: "/s/abc/recipes" });
    expect(await screen.findByRole("heading", { name: "Se connecter" })).toBeInTheDocument();
  });
});

describe("connexion (P01)", () => {
  it("se connecte (rester connecte) puis ouvre la page demandee", async () => {
    const { bodies, account } = loggedOut();
    const { user } = renderWithProviders(<App />, {
      route: `/login?next=${encodeURIComponent(`/s/${account.personalSpaceId}/recipes`)}`,
    });
    await user.type(await screen.findByLabelText("E-mail ou nom d'utilisateur"), "matthias");
    await user.type(screen.getByLabelText("Mot de passe"), "bon-mot-de-passe");
    await user.click(screen.getByRole("switch", { name: "Rester connecté" }));
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { name: "Recettes" })).toBeInTheDocument();
    expect(bodies.login).toEqual({
      identifier: "matthias",
      password: "bon-mot-de-passe",
      rememberMe: true,
    });
  });

  it("identifiants refuses : message clair ; sans SMTP, pas de mot de passe oublie (D21)", async () => {
    loggedOut({ email: false });
    const { user } = renderWithProviders(<App />, { route: "/login" });
    await user.type(await screen.findByLabelText("E-mail ou nom d'utilisateur"), "matthias");
    await user.type(screen.getByLabelText("Mot de passe"), "mauvais");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiants incorrects.");
    expect(screen.queryByRole("link", { name: "Mot de passe oublié ?" })).not.toBeInTheDocument();
  });

  it("champs obligatoires", async () => {
    loggedOut();
    const { user } = renderWithProviders(<App />, { route: "/login" });
    await user.click(await screen.findByRole("button", { name: "Se connecter" }));
    expect(screen.getByLabelText("E-mail ou nom d'utilisateur")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

describe("inscription (P01)", () => {
  it("cree le compte, demande de confirmer l'adresse puis accueille (D61)", async () => {
    const { bodies } = loggedOut();
    const { user } = renderWithProviders(<App />, { route: "/register" });
    await user.type(await screen.findByLabelText("Adresse e-mail"), "matthias@exemple.fr");
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "matthias");
    await user.type(screen.getByLabelText("Mot de passe"), "un-mot-de-passe-solide");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(
      await screen.findByRole("heading", { name: "Confirme ton adresse" })
    ).toBeInTheDocument();
    expect(screen.getByText("matthias@exemple.fr")).toBeInTheDocument();
    expect(bodies.register).toEqual({
      email: "matthias@exemple.fr",
      username: "matthias",
      password: "un-mot-de-passe-solide",
    });
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByRole("heading", { name: "Bienvenue, matthias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Créer un espace/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /J'ai un lien d'invitation/ })).toBeInTheDocument();
  });

  it("mot de passe trop court et nom deja pris", async () => {
    loggedOut({ email: false });
    const { user } = renderWithProviders(<App />, { route: "/register" });
    await user.type(await screen.findByLabelText("Adresse e-mail"), "a@exemple.fr");
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "pris");
    await user.type(screen.getByLabelText("Mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(/10/);
    await user.clear(screen.getByLabelText("Mot de passe"));
    await user.type(screen.getByLabelText("Mot de passe"), "un-mot-de-passe-solide");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Nom d'utilisateur")).toHaveAccessibleDescription(
        "Ce nom d'utilisateur est déjà pris."
      );
    });
  });

  it("un lien d'invitation survit a l'inscription (D62)", async () => {
    loggedOut({ email: false });
    server.use(
      http.get("/api/v1/invite-links/:code", () =>
        HttpResponse.json(errorBody("SPACE_014"), { status: 410 })
      )
    );
    const code = "b".repeat(22);
    const { user } = renderWithProviders(<App />, {
      route: `/register?next=${encodeURIComponent(`/join/${code}`)}`,
    });
    await user.type(await screen.findByLabelText("Adresse e-mail"), "a@exemple.fr");
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "nouveau");
    await user.type(screen.getByLabelText("Mot de passe"), "un-mot-de-passe-solide");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByText(/n'est plus valable/)).toBeInTheDocument();
  });
});

describe("mot de passe et email (D21)", () => {
  it("mot de passe oublie : meme confirmation dans tous les cas", async () => {
    const { bodies } = loggedOut();
    const { user } = renderWithProviders(<App />, { route: "/forgot-password" });
    await user.type(await screen.findByLabelText("Adresse e-mail"), "quelqu.un@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Lien envoyé/);
    expect(bodies.forgot).toEqual({ email: "quelqu.un@exemple.fr" });
  });

  it("nouveau mot de passe : confirmation identique, puis connexion", async () => {
    const { bodies } = loggedOut();
    const { user } = renderWithProviders(<App />, { route: `/reset-password?token=${TOKEN}` });
    await user.type(await screen.findByLabelText("Nouveau mot de passe"), "un-mot-de-passe-solide");
    await user.type(screen.getByLabelText("Confirme-le"), "autre-chose-encore");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(screen.getByLabelText("Confirme-le")).toHaveAccessibleDescription(
      "Les deux mots de passe ne sont pas identiques."
    );
    await user.clear(screen.getByLabelText("Confirme-le"));
    await user.type(screen.getByLabelText("Confirme-le"), "un-mot-de-passe-solide");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByRole("heading", { name: "Se connecter" })).toBeInTheDocument();
    expect(bodies.reset).toEqual({ token: TOKEN, password: "un-mot-de-passe-solide" });
  });

  it("verification d'email : succes ou lien expire", async () => {
    loggedOut();
    const ok = renderWithProviders(<App />, { route: `/verify-email?token=${TOKEN}` });
    expect(await screen.findByRole("heading", { name: "Adresse confirmée" })).toBeInTheDocument();
    ok.unmount();
    renderWithProviders(<App />, { route: `/verify-email?token=bad${"a".repeat(40)}` });
    expect(await screen.findByText("Ce lien est invalide ou a expiré.")).toBeInTheDocument();
  });
});
