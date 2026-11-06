import { errorBody, type Me } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { buildMe, buildPersonalSpace, buildSpaceDetail } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";
import { mockUploads, photoFile, signedUrl } from "../../test/uploads.ts";

vi.mock("../../lib/image.ts", () => import("../../test/fake-image.ts"));

function profileServer() {
  let me: Me | null = buildMe({ username: "matthias", email: "matthias@exemple.fr" });
  const account = me;
  mockSession({ me, spaces: [buildPersonalSpace(me), buildSpaceDetail({ name: "Famille" })] });
  const bodies: Record<string, unknown> = {};
  server.use(
    http.get("/api/v1/me", () =>
      me ? HttpResponse.json(me) : HttpResponse.json(errorBody("AUTH_001"), { status: 401 })
    ),
    http.post("/api/v1/auth/logout", () => {
      me = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch("/api/v1/me/preferences", async ({ request }) => {
      bodies.preferences = await request.json();
      me = me && { ...me, preferences: { ...me.preferences, ...(bodies.preferences as object) } };
      return HttpResponse.json(me);
    }),
    http.patch("/api/v1/me", async ({ request }) => {
      bodies.profile = await request.json();
      me = me && { ...me, ...(bodies.profile as object) };
      return HttpResponse.json(me);
    }),
    http.put("/api/v1/me/password", async ({ request }) => {
      bodies.password = await request.json();
      const { currentPassword } = bodies.password as { currentPassword: string };
      return currentPassword === "actuel-correct"
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(errorBody("AUTH_005"), { status: 403 });
    }),
    http.get("/api/v1/me/deletion-preview", () =>
      HttpResponse.json({
        spaces: [
          {
            space: { id: account.personalSpaceId, name: "Famille", tintIndex: 1, avatarUrl: null },
            role: "OWNER",
            outcome: "TRANSFERRED",
            newOwner: { id: account.id, username: "lea", avatarUrl: null },
          },
          {
            space: { id: account.id, name: "Amis", tintIndex: 4, avatarUrl: null },
            role: "MEMBER",
            outcome: "LEFT",
            newOwner: null,
          },
        ],
      })
    ),
    http.delete("/api/v1/me", async ({ request }) => {
      bodies.delete = await request.json();
      const { password } = bodies.delete as { password: string };
      if (password !== "actuel-correct")
        return HttpResponse.json(errorBody("AUTH_005"), { status: 403 });
      me = null;
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { account, bodies };
}

describe("profil (E-PROFIL)", () => {
  it("change la photo de profil puis la retire (D167)", async () => {
    const { account } = profileServer();
    const { uploadIds } = mockUploads();
    let avatarUrl: string | null = null;
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/v1/me", () => HttpResponse.json({ ...account, avatarUrl })),
      http.put("/api/v1/me/avatar", async ({ request }) => {
        bodies.push(await request.json());
        avatarUrl = signedUrl("users/me/1.webp");
        return HttpResponse.json({ url: avatarUrl });
      }),
      http.delete("/api/v1/me/avatar", () => {
        avatarUrl = null;
        return HttpResponse.json({ url: null });
      })
    );
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    await user.upload(await screen.findByLabelText("Ajouter la photo"), photoFile());
    await waitFor(() => {
      expect(bodies).toEqual([{ uploadId: uploadIds[0] }]);
    });
    const avatar = screen.getAllByRole("img", { name: "matthias" })[0];
    await waitFor(() => {
      expect(avatar?.querySelector("img")).toHaveAttribute("src", signedUrl("users/me/1.webp"));
    });

    await user.click(screen.getByRole("button", { name: "Retirer la photo" }));
    expect(await screen.findByRole("button", { name: "Ajouter la photo" })).toBeInTheDocument();
  });

  it("sans stockage configure, pas de choix de photo", async () => {
    profileServer();
    renderWithProviders(<App />, { route: "/profile" });
    expect(await screen.findByRole("heading", { name: "matthias" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter la photo" })).not.toBeInTheDocument();
  });

  it("montre le compte et se deconnecte", async () => {
    profileServer();
    const { user } = renderWithProviders(<App />, { route: "/profile" });
    expect(await screen.findByRole("heading", { name: "matthias" })).toBeInTheDocument();
    expect(screen.getByText("matthias@exemple.fr")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(await screen.findByRole("link", { name: "Se connecter" })).toBeInTheDocument();
  });

  it("change le nom d'utilisateur ; l'email demande le mot de passe actuel", async () => {
    const { bodies } = profileServer();
    const { user } = renderWithProviders(<App />, { route: "/profile/account" });
    const username = await screen.findByLabelText("Nom d'utilisateur");
    await user.clear(username);
    await user.type(username, "matt");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(bodies.profile).toEqual({ username: "matt" });
    });
    const email = screen.getByLabelText("Adresse e-mail");
    await user.clear(email);
    await user.type(email, "nouvelle@exemple.fr");
    expect(screen.getByLabelText("Mot de passe actuel")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mot de passe actuel"), "actuel-correct");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(bodies.profile).toEqual({
        email: "nouvelle@exemple.fr",
        currentPassword: "actuel-correct",
      });
    });
  });

  it("change le mot de passe ; mot de passe actuel refuse", async () => {
    const { bodies } = profileServer();
    const { user } = renderWithProviders(<App />, { route: "/profile/password" });
    await user.type(await screen.findByLabelText("Mot de passe actuel"), "faux");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "un-nouveau-solide");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Mot de passe actuel")).toHaveAccessibleDescription(
        "Mot de passe actuel incorrect."
      );
    });
    await user.clear(screen.getByLabelText("Mot de passe actuel"));
    await user.type(screen.getByLabelText("Mot de passe actuel"), "actuel-correct");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(
      await screen.findByText("Mot de passe changé. Tes autres appareils sont déconnectés.")
    ).toBeInTheDocument();
    expect(bodies.password).toEqual({
      currentPassword: "actuel-correct",
      newPassword: "un-nouveau-solide",
    });
  });
});

describe("apparence (E-APPARENCE, D115)", () => {
  it("applique l'ambiance tout de suite et l'enregistre", async () => {
    const { bodies } = profileServer();
    const { user } = renderWithProviders(<App />, { route: "/profile/appearance" });
    await user.click(await screen.findByRole("radio", { name: /Sous-bois/ }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "sousbois-dark");
    });
    expect(bodies.preferences).toEqual({ ambiance: "SOUSBOIS" });
    await user.click(screen.getByRole("button", { name: "Clair" }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "sousbois-light");
    });
    await user.click(screen.getByRole("radio", { name: /Grande/ }));
    await waitFor(() => {
      expect(bodies.preferences).toEqual({ textScale: 115 });
    });
  });
});

describe("supprimer le compte (F-SUPPRIMER-COMPTE, D116)", () => {
  it("montre les consequences par espace, puis supprime avec le mot de passe", async () => {
    const { bodies } = profileServer();
    const { user } = renderWithProviders(<App />, { route: "/profile/delete" });
    const famille = await screen.findByRole("listitem", { name: "Famille" });
    expect(
      within(famille).getByText("Tu en es propriétaire : propriété transférée à lea")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Amis" })).getByText("Tu quittes l'espace")
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mot de passe"), "faux");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement mon compte" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(
        "Mot de passe actuel incorrect."
      );
    });
    await user.clear(screen.getByLabelText("Mot de passe"));
    await user.type(screen.getByLabelText("Mot de passe"), "actuel-correct");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement mon compte" }));
    expect(await screen.findByText("Ton compte a été supprimé")).toBeInTheDocument();
    // Le toast s'affiche tout de suite ; la navigation vers l'accueil est une transition.
    expect(await screen.findByRole("link", { name: "Se connecter" })).toBeInTheDocument();
    expect(bodies.delete).toEqual({ password: "actuel-correct" });
  });
});
