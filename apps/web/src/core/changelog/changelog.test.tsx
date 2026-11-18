// Changelog (C6.6) [D187, D127] : A10 dans l'admin, page Nouveautes des utilisateurs.
import type { AdminRelease, Release } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { mockAdminApi } from "../../test/admin-server.ts";
import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockSession } from "../../test/session.ts";

const NOW = new Date().toISOString();

function buildRelease(over: Partial<AdminRelease> = {}): AdminRelease {
  return {
    id: crypto.randomUUID(),
    version: "2.1.0",
    title: "Version 2.1.0",
    content: {
      features: [{ text: "Recettes composees" }],
      improvements: [],
      fixes: [{ text: "Quantites en cuilleres" }],
    },
    status: "DRAFT",
    publishedAt: null,
    notifiedAt: null,
    isPublic: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

/** Versions de l'admin, modifiees par les appels ; renvoie les requetes recues. */
function releaseServer(releases: AdminRelease[]) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const find = (id: unknown) => releases.find((r) => r.id === id);
  const respond = (release: AdminRelease | undefined, change: Partial<AdminRelease>) => {
    if (!release) return HttpResponse.json({}, { status: 404 });
    Object.assign(release, change);
    return HttpResponse.json(release);
  };
  server.use(
    http.get("/api/v1/admin/releases", () => HttpResponse.json({ data: releases })),
    http.patch("/api/v1/admin/releases/:id", async ({ params, request }) => {
      const body = (await request.json()) as Pick<AdminRelease, "title" | "content" | "isPublic">;
      calls.push({ method: "PATCH", path: String(params.id), body });
      return respond(find(params.id), body);
    }),
    http.post("/api/v1/admin/releases/:id/:action", async ({ params, request }) => {
      const action = String(params.action);
      const body = action === "publish" ? await request.json() : null;
      calls.push({ method: action, path: String(params.id), body });
      const status = action === "hide" ? "HIDDEN" : "PUBLISHED";
      return respond(find(params.id), { status, publishedAt: NOW });
    })
  );
  return calls;
}

describe("A10 : changelog de l'admin", () => {
  it("liste les versions, ouvre la plus recente et la reformule avant de la publier", async () => {
    mockAdminApi();
    const draft = buildRelease();
    const published = buildRelease({
      version: "2.0.0",
      title: "La nouvelle version",
      status: "PUBLISHED",
      publishedAt: NOW,
    });
    const calls = releaseServer([draft, published]);
    const user = userEvent.setup();
    const { container } = renderWithProviders(<App />, { route: "/admin/changelog" });

    const versions = await screen.findByRole("navigation", { name: "Versions" });
    expect(
      within(versions)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual([expect.stringContaining("2.1.0Brouillon"), expect.stringContaining("2.0.0Publiée")]);
    const editor = screen.getByRole("region", { name: "Version 2.1.0" });
    expect(within(editor).getByText("Brouillon")).toBeInTheDocument();

    await user.clear(within(editor).getByLabelText("Titre"));
    await user.type(within(editor).getByLabelText("Titre"), "Les recettes composees arrivent");
    // Reformuler une ligne, en retirer une, en ajouter une.
    await user.click(
      within(editor).getByRole("button", { name: "Reformuler : Recettes composees" })
    );
    const line = within(editor).getByRole("textbox", { name: "Ligne de Nouveautés" });
    await user.clear(line);
    await user.type(line, "Une recette peut en contenir d'autres{Enter}");
    await user.click(
      within(editor).getByRole("button", { name: "Retirer cette ligne : Quantites en cuilleres" })
    );
    await user.click(
      within(editor).getByRole("button", { name: "Ajouter une ligne à Améliorations" })
    );
    await user.type(
      within(editor).getByRole("textbox", { name: "Ligne de Améliorations" }),
      "Planning plus rapide"
    );

    const visible = within(editor).getByRole("switch", { name: "Visible sans connexion" });
    expect(visible).not.toBeChecked();
    await user.click(visible);

    const notifyAll = within(editor).getByRole("switch", {
      name: "Prévenir tous les utilisateurs par une notification",
    });
    expect(notifyAll).toBeChecked();
    await user.click(within(editor).getByRole("button", { name: "Publier la version" }));

    await waitFor(() => {
      expect(calls.map((c) => c.method)).toEqual(["PATCH", "publish"]);
    });
    expect(calls[0]?.body).toEqual({
      title: "Les recettes composees arrivent",
      content: {
        features: [{ text: "Une recette peut en contenir d'autres" }],
        improvements: [{ text: "Planning plus rapide" }],
        fixes: [],
      },
      isPublic: true,
    });
    expect(calls[1]?.body).toEqual({ notify: true });
    expect(await within(editor).findByText("Publiée")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("enregistre un brouillon ; masque puis reaffiche une version publiee", async () => {
    mockAdminApi();
    const draft = buildRelease();
    const published = buildRelease({ version: "2.0.0", status: "PUBLISHED", publishedAt: NOW });
    const calls = releaseServer([draft, published]);
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: "/admin/changelog" });

    const editor = await screen.findByRole("region", { name: "Version 2.1.0" });
    await user.click(within(editor).getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => {
      expect(calls.map((c) => c.method)).toEqual(["PATCH"]);
    });

    await user.click(screen.getByRole("link", { name: /2\.0\.0/ }));
    const shown = await screen.findByRole("region", { name: "Version 2.0.0" });
    expect(within(shown).queryByRole("button", { name: "Publier la version" })).toBeNull();
    await user.click(within(shown).getByRole("button", { name: "Masquer" }));
    expect(await within(shown).findByText("Masquée")).toBeInTheDocument();
    await user.click(within(shown).getByRole("button", { name: "Réafficher" }));
    await waitFor(() => {
      expect(calls.map((c) => c.method)).toEqual(["PATCH", "hide", "show"]);
    });
  });

  it("les lignes s'affichent en Markdown, le texte brut a la reformulation [D226]", async () => {
    mockAdminApi();
    const draft = buildRelease({
      content: {
        features: [{ text: "Les **recettes** et [le guide](https://example.com/guide)" }],
        improvements: [],
        fixes: [],
      },
    });
    releaseServer([draft]);
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: "/admin/changelog" });

    const editor = await screen.findByRole("region", { name: "Version 2.1.0" });
    expect(within(editor).getByText("recettes").tagName).toBe("STRONG");
    expect(within(editor).getByRole("link", { name: "le guide" })).toHaveAttribute(
      "href",
      "https://example.com/guide"
    );
    expect(within(editor).getByText(/\*\*gras\*\*/)).toBeInTheDocument();
    await user.click(
      within(editor).getByRole("button", {
        name: "Reformuler : Les **recettes** et [le guide](https://example.com/guide)",
      })
    );
    expect(within(editor).getByRole("textbox", { name: "Ligne de Nouveautés" })).toHaveValue(
      "Les **recettes** et [le guide](https://example.com/guide)"
    );
  });

  it("entree Changelog dans la navigation", async () => {
    mockAdminApi();
    releaseServer([]);
    renderWithProviders(<App />, { route: "/admin/changelog" });
    const nav = await screen.findByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: /Changelog/ })).toHaveAttribute(
      "href",
      "/admin/changelog"
    );
    expect(await screen.findByText(/Aucune version pour l'instant/)).toBeInTheDocument();
  });
});

describe("Nouveautes (utilisateurs)", () => {
  const RELEASES: Release[] = [
    {
      version: "2.1.0",
      title: "Les recettes composees arrivent",
      content: {
        features: [{ text: "Une recette peut en contenir d'autres" }],
        improvements: [],
        fixes: [{ text: "Quantites en cuilleres" }],
      },
      publishedAt: "2026-11-03T10:00:00.000Z",
    },
    {
      version: "2.0.0",
      title: "La nouvelle version",
      content: { features: [{ text: "Tout est neuf" }], improvements: [], fixes: [] },
      publishedAt: "2026-10-31T10:00:00.000Z",
    },
  ];

  it("versions publiees, la plus recente d'abord, sections non vides", async () => {
    mockSession();
    server.use(http.get("/api/v1/releases", () => HttpResponse.json({ data: RELEASES })));
    const { container } = renderWithProviders(<App />, { route: "/news" });

    const latest = await screen.findByRole("article", { name: /Les recettes composees arrivent/ });
    expect(latest).toHaveTextContent("Version 2.1.0");
    expect(latest).toHaveTextContent("3 novembre 2026");
    expect(within(latest).getByRole("heading", { name: "Nouveautés" })).toBeInTheDocument();
    expect(within(latest).getByRole("heading", { name: "Corrections" })).toBeInTheDocument();
    expect(within(latest).queryByRole("heading", { name: "Améliorations" })).toBeNull();
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("titre par defaut : la version n'est pas ecrite deux fois", async () => {
    mockSession();
    const release: Release = { ...RELEASES[1]!, title: "Version 2.0.0" };
    server.use(http.get("/api/v1/releases", () => HttpResponse.json({ data: [release] })));
    renderWithProviders(<App />, { route: "/news" });

    const article = await screen.findByRole("article", { name: "Version 2.0.0" });
    expect(article.textContent.match(/Version 2\.0\.0/g)).toHaveLength(1);
    expect(article).toHaveTextContent("31 octobre 2026");
  });

  it("lignes en Markdown, sans HTML brut [D226]", async () => {
    mockSession();
    const release: Release = {
      ...RELEASES[1]!,
      content: {
        features: [{ text: "Un **planning** et <b>rien</b> [ici](https://example.com)" }],
        improvements: [],
        fixes: [],
      },
    };
    server.use(http.get("/api/v1/releases", () => HttpResponse.json({ data: [release] })));
    renderWithProviders(<App />, { route: "/news" });

    const article = await screen.findByRole("article", { name: "La nouvelle version" });
    expect(within(article).getByText("planning").tagName).toBe("STRONG");
    expect(within(article).getByRole("link", { name: "ici" })).toHaveAttribute(
      "href",
      "https://example.com"
    );
    expect(article).toHaveTextContent("<b>rien</b>");
    expect(article.querySelector("b:not(.font-mono)")).toBeNull();
  });

  it("lisible sans connexion, avec un lien pour se connecter [D226]", async () => {
    mockSession({ me: null });
    server.use(http.get("/api/v1/releases", () => HttpResponse.json({ data: RELEASES })));
    const { container } = renderWithProviders(<App />, { route: "/news" });

    expect(
      await screen.findByRole("article", { name: /Les recettes composees arrivent/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Nouveautés" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("lien depuis la page de connexion [D226]", async () => {
    mockSession({ me: null });
    renderWithProviders(<App />, { route: "/login" });
    expect(await screen.findByRole("link", { name: "Nouveautés" })).toHaveAttribute(
      "href",
      "/news"
    );
  });

  it("lien depuis le profil", async () => {
    mockSession();
    renderWithProviders(<App />, { route: "/profile" });
    const nav = await screen.findByRole("navigation", { name: "Réglages du profil" });
    expect(within(nav).getByRole("link", { name: /Nouveautés/ })).toHaveAttribute("href", "/news");
  });
});
