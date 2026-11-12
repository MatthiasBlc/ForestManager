// Administration, C4.1 : connexion avec 2FA (A01, A01a, A01b), shell et tableau de bord.
import { errorBody, type AdminMe } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildDashboard } from "../../test/admin-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { buildConfig } from "../../test/fixtures.ts";

const ADMIN: AdminMe = {
  id: "7c1e7a5e-2c1b-4f55-9b0e-1d2a3b4c5d6e",
  username: "root_admin",
  email: "root@forest.local",
  sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

/** API admin simulee : sans session au depart ; le bon code est 123456. */
function adminServer({ totpEnabled = true, loggedIn = false } = {}) {
  let me: AdminMe | null = loggedIn ? ADMIN : null;
  const calls: string[] = [];
  server.use(
    http.get("/api/v1/config", () =>
      HttpResponse.json(buildConfig({ email: true, uploads: false }))
    ),
    http.get("/api/v1/me", () => HttpResponse.json(errorBody("AUTH_001"), { status: 401 })),
    http.get("/api/v1/admin/module-requests", () => HttpResponse.json({ pending: [], recent: [] })),
    http.get("/api/v1/admin/dashboard", () => HttpResponse.json(buildDashboard())),
    http.get("/api/v1/admin/me", () =>
      me ? HttpResponse.json(me) : HttpResponse.json(errorBody("ADMIN_002"), { status: 401 })
    ),
    http.post("/api/v1/admin/auth/login", async ({ request }) => {
      const body = (await request.json()) as { identifier: string; password: string };
      calls.push(`login:${body.identifier}`);
      if (body.password !== "bon-mot-de-passe")
        return HttpResponse.json(errorBody("ADMIN_001"), { status: 401 });
      return HttpResponse.json(
        totpEnabled
          ? { step: "CODE" }
          : {
              step: "SETUP",
              secret: "JBSWY3DPEHPK3PXP",
              otpauthUri: "otpauth://totp/Forest%20Manager:root",
              qrCode: "data:image/png;base64,iVBORw0KGgo=",
            }
      );
    }),
    http.post("/api/v1/admin/auth/totp", async ({ request }) => {
      const { code } = (await request.json()) as { code: string };
      calls.push(`totp:${code}`);
      if (code !== "123456") return HttpResponse.json(errorBody("ADMIN_003"), { status: 401 });
      me = ADMIN;
      return HttpResponse.json(me);
    }),
    http.post("/api/v1/admin/auth/logout", () => {
      calls.push("logout");
      me = null;
      return new HttpResponse(null, { status: 204 });
    })
  );
  return {
    calls,
    expire: () => {
      me = null;
    },
  };
}

async function fillCredentials(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(await screen.findByLabelText("Identifiant ou e-mail"), "root_admin");
  await user.type(screen.getByLabelText("Mot de passe"), "bon-mot-de-passe");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
}

describe("connexion admin", () => {
  it("sans session, /admin ouvre la connexion admin, distincte du compte utilisateur", async () => {
    adminServer();
    const { container } = renderWithProviders(<App />, { route: "/admin" });
    expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByText(/distinct de ton compte utilisateur/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("premiere connexion : QR code, cle a saisir, puis code et tableau de bord", async () => {
    const api = adminServer({ totpEnabled: false });
    const { user, container } = renderWithProviders(<App />, { route: "/admin" });
    await fillCredentials(user);

    expect(
      await screen.findByRole("heading", { name: "Protège ton compte admin" })
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR code/ })).toHaveAttribute(
      "src",
      "data:image/png;base64,iVBORw0KGgo="
    );
    // Cle groupee par 4 pour la saisie a la main.
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.type(screen.getByLabelText("Saisis le code affiché"), "123 456");
    await user.click(screen.getByRole("button", { name: "Activer et continuer" }));

    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
    expect(api.calls).toEqual(["login:root_admin", "totp:123456"]);
  });

  it("connexion suivante : code demande ; un code faux reste sur l'ecran avec l'erreur", async () => {
    adminServer();
    const { user } = renderWithProviders(<App />, { route: "/admin" });
    await fillCredentials(user);
    const input = await screen.findByLabelText("Code à 6 chiffres");
    expect(screen.getByRole("heading", { name: "Code de vérification" })).toBeInTheDocument();
    expect(screen.getByText(/pour root_admin/)).toBeInTheDocument();
    expect(input).toHaveAttribute("autocomplete", "one-time-code");

    await user.type(input, "000000");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Code de vérification incorrect.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revenir à l'identifiant" }));
    expect(await screen.findByLabelText("Identifiant ou e-mail")).toBeInTheDocument();
  });

  it("un mauvais mot de passe affiche l'erreur sans passer a l'etape du code", async () => {
    adminServer();
    const { user } = renderWithProviders(<App />, { route: "/admin" });
    await user.type(await screen.findByLabelText("Identifiant ou e-mail"), "root_admin");
    await user.type(screen.getByLabelText("Mot de passe"), "mauvais");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiants incorrects.");
    expect(screen.queryByLabelText("Code à 6 chiffres")).not.toBeInTheDocument();
  });
});

describe("shell admin", () => {
  it("navigation, compte et duree restante de la session", async () => {
    adminServer({ loggedIn: true });
    const { container } = renderWithProviders(<App />, { route: "/admin" });
    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getAllByText("root_admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Session admin, expire dans (29|30) min/).length).toBeGreaterThan(0);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("se deconnecter ramene a la connexion admin", async () => {
    const api = adminServer({ loggedIn: true });
    const { user } = renderWithProviders(<App />, { route: "/admin" });
    await screen.findByRole("heading", { name: "Tableau de bord" });
    await user.click(screen.getAllByRole("button", { name: "Se déconnecter" })[0] as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(api.calls).toContain("logout");
  });

  it("une session expiree ramene a la connexion", async () => {
    const api = adminServer({ loggedIn: true });
    const { client } = renderWithProviders(<App />, { route: "/admin" });
    await screen.findByRole("heading", { name: "Tableau de bord" });
    api.expire();
    await client.invalidateQueries({ queryKey: ["admin"] });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Administration" })).toBeInTheDocument();
    });
  });

  it("une adresse admin inconnue renvoie au tableau de bord", async () => {
    adminServer({ loggedIn: true });
    renderWithProviders(<App />, { route: "/admin/nope" });
    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
  });
});
