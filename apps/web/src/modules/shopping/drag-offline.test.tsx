// Liste de courses (C9 etape 4d) : appui long puis glisser (dans la section ou vers une
// autre), lecture et coches hors ligne envoyees au retour du reseau [D228, D231].
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { errorBody } from "@fm/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { NOW } from "../../test/fixtures.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { buildItem, buildSection, shoppingServer } from "../../test/shopping-server.ts";

const primeur = buildSection("Primeur");
const alimentaire = buildSection("Alimentaire");

function listServer(options: Parameters<typeof shoppingServer>[0] = {}) {
  return shoppingServer({
    sections: [primeur, alimentaire],
    items: [
      buildItem({ sectionId: primeur.id, label: "Avocats", sortOrder: 0 }),
      buildItem({ sectionId: primeur.id, label: "Poireaux", sortOrder: 1 }),
      buildItem({ sectionId: primeur.id, label: "Citrons", checkedAt: NOW, sortOrder: 2 }),
      buildItem({ sectionId: alimentaire.id, label: "Lait", sortOrder: 0 }),
      buildItem({ sectionId: alimentaire.id, label: "Riz", sortOrder: 1 }),
      buildItem({ sectionId: null, label: "Piles", sortOrder: 0 }),
    ],
    ...options,
  });
}

const route = (s: { space: { id: string } }) => `/s/${s.space.id}/shopping`;
const idOf = (s: ReturnType<typeof listServer>, label: string) =>
  s.shop.items.find((i) => i.label === label)?.id;
const row = (label: string) =>
  screen.getByRole("checkbox", { name: label }).closest("li") as HTMLElement;
const mouse = { pointerType: "mouse", button: 0 };
const finger = { pointerType: "touch", button: 0 };

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => {
    setOnline(true);
  });
});

describe("E-COURSES : glisser pour ranger", () => {
  it("a la souris, dans la section : l'article prend la place de l'autre", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Riz" });
    const from = row("Riz");
    const to = row("Lait");
    fireEvent.pointerDown(from, { ...mouse, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(to, { ...mouse, clientX: 10, clientY: 50 });
    expect(from).toHaveAttribute("data-drag-source");
    expect(to).toHaveAttribute("data-drop-over");
    fireEvent.pointerUp(to, { ...mouse, clientX: 10, clientY: 50 });

    // Nouvel ordre affiche avant la reponse du serveur.
    const food = screen.getByRole("region", { name: "Alimentaire" });
    await waitFor(() => {
      expect(
        within(food)
          .getAllByRole("checkbox")
          .map((box) => box.getAttribute("aria-label"))
      ).toEqual(["Riz", "Lait"]);
    });
    await waitFor(() => {
      expect(s.shop.orders).toEqual([
        { sectionId: alimentaire.id, ids: [idOf(s, "Riz"), idOf(s, "Lait")] },
      ]);
    });
    expect(s.shop.patches).toEqual([]);
  });

  it("vers le bas, il prend aussi la place de l'autre", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Avocats" });
    fireEvent.pointerDown(row("Avocats"), { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(row("Poireaux"), { ...mouse, clientX: 10, clientY: 60 });
    fireEvent.pointerUp(row("Poireaux"), { ...mouse, clientX: 10, clientY: 60 });
    await waitFor(() => {
      expect(s.shop.orders).toEqual([
        {
          sectionId: primeur.id,
          ids: [idOf(s, "Poireaux"), idOf(s, "Avocats"), idOf(s, "Citrons")],
        },
      ]);
    });
  });

  it("au doigt, vers une autre section : appui long, puis glisser sur un article", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Lait" });
    const from = row("Lait");
    fireEvent.pointerDown(from, { ...finger, clientX: 10, clientY: 200 });
    await waitFor(
      () => {
        expect(from).toHaveAttribute("data-drag-lifted");
      },
      { timeout: 1500 }
    );
    const to = row("Avocats");
    fireEvent.pointerMove(to, { ...finger, clientX: 10, clientY: 20 });
    fireEvent.pointerUp(to, { ...finger, clientX: 10, clientY: 20 });

    expect(
      await within(screen.getByRole("region", { name: "Primeur" })).findByRole("checkbox", {
        name: "Lait",
      })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(s.shop.orders).toHaveLength(1);
    });
    // La section d'abord (favorite fixee par l'API si le produit n'en a pas), puis l'ordre.
    expect(s.shop.patches).toEqual([{ itemId: idOf(s, "Lait"), sectionId: primeur.id }]);
    expect(s.shop.orders[0]).toEqual({
      sectionId: primeur.id,
      ids: [idOf(s, "Lait"), idOf(s, "Avocats"), idOf(s, "Poireaux"), idOf(s, "Citrons")],
    });
  });

  it("lache sur le titre d'une section : en fin de ses articles a acheter", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Lait" });
    const head = screen.getByRole("button", { name: /Autres/ });
    fireEvent.pointerDown(row("Lait"), { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(head, { ...mouse, clientX: 10, clientY: 300 });
    expect(head).toHaveAttribute("data-drop-over");
    fireEvent.pointerUp(head, { ...mouse, clientX: 10, clientY: 300 });
    await waitFor(() => {
      expect(s.shop.patches).toEqual([{ itemId: idOf(s, "Lait"), sectionId: null }]);
    });
    expect(s.shop.orders).toEqual([]);
  });

  it("appui long sans bouger : ouvre le detail", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Riz" });
    const from = row("Riz");
    fireEvent.pointerDown(from, { ...finger, clientX: 10, clientY: 10 });
    await waitFor(
      () => {
        expect(from).toHaveAttribute("data-drag-lifted");
      },
      { timeout: 1500 }
    );
    fireEvent.pointerUp(from, { ...finger, clientX: 10, clientY: 10 });
    expect(await screen.findByRole("dialog", { name: "Riz" })).toBeInTheDocument();
  });

  it("un article achete ne se prend pas ; sans le droit de modifier, rien ne se prend", async () => {
    const s = listServer();
    renderWithProviders(<App />, { route: route(s) });
    await screen.findByRole("checkbox", { name: "Citrons" });
    expect(row("Citrons")).not.toHaveAttribute("data-drag-id");
    expect(row("Avocats")).toHaveAttribute("data-drag-id");
    cleanup();

    const read = listServer({ myRole: "MEMBER", editRole: "MODERATOR" });
    renderWithProviders(<App />, { route: route(read) });
    await screen.findByRole("checkbox", { name: "Avocats" });
    expect(row("Avocats")).not.toHaveAttribute("data-drag-id");
  });
});

describe("E-COURSES hors ligne : lecture et coches", () => {
  it("on coche hors ligne ; les coches partent au retour du reseau", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await screen.findByText("5 à acheter");
    act(() => {
      setOnline(false);
    });
    expect(
      screen.getByText("Hors ligne : tu peux cocher, l'envoi se fera au retour du réseau.")
    ).toBeInTheDocument();
    // Le reste attend le reseau : pas de glisser.
    expect(row("Lait")).not.toHaveAttribute("data-drag-id");

    await user.click(screen.getByRole("checkbox", { name: "Lait" }));
    await user.click(screen.getByRole("checkbox", { name: "Citrons" }));
    expect(screen.getByRole("checkbox", { name: "Lait" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Citrons" })).not.toBeChecked();
    expect(screen.getByText("5 à acheter")).toBeInTheDocument();
    expect(screen.getByText("2 coches en attente d'envoi.")).toBeInTheDocument();
    expect(s.shop.patches).toEqual([]);

    act(() => {
      setOnline(true);
    });
    await waitFor(() => {
      expect(s.shop.patches).toHaveLength(2);
    });
    expect(s.shop.patches).toEqual(
      expect.arrayContaining([
        { itemId: idOf(s, "Lait"), checked: true, checkedChangedAt: expect.any(String) },
        { itemId: idOf(s, "Citrons"), checked: false, checkedChangedAt: expect.any(String) },
      ])
    );
    await waitFor(() => {
      expect(screen.queryByText(/en attente d'envoi/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("checkbox", { name: "Lait" })).toBeChecked();
  });

  it("la derniere coche gagne : cocher puis decocher envoie une seule coche", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await screen.findByText("5 à acheter");
    act(() => {
      setOnline(false);
    });
    const box = screen.getByRole("checkbox", { name: "Riz" });
    await user.click(box);
    await user.click(box);
    expect(box).not.toBeChecked();
    expect(screen.getByText("1 coche en attente d'envoi.")).toBeInTheDocument();
    act(() => {
      setOnline(true);
    });
    await waitFor(() => {
      expect(s.shop.patches).toEqual([
        { itemId: idOf(s, "Riz"), checked: false, checkedChangedAt: expect.any(String) },
      ]);
    });
  });

  it("article retire entre-temps : la coche est ignoree, sans message d'erreur", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await screen.findByText("5 à acheter");
    act(() => {
      setOnline(false);
    });
    await user.click(screen.getByRole("checkbox", { name: "Lait" }));
    const laitId = idOf(s, "Lait");
    s.shop.items = s.shop.items.filter((i) => i.id !== laitId);
    server.use(
      http.patch(`/api/v1/spaces/${s.space.id}/shopping/items/${String(laitId)}`, () =>
        HttpResponse.json(errorBody("SHOPPING_001"), { status: 404 })
      )
    );
    act(() => {
      setOnline(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole("checkbox", { name: "Lait" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/en attente d'envoi/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Hors ligne, la liste relue au rechargement vient du cache persistant (offline-cache) ;
  // ici, la file des coches survit au rechargement et part a l'ouverture suivante.
  it("les coches en attente restent sur l'appareil et partent a la prochaine ouverture", async () => {
    const s = listServer();
    const { user } = renderWithProviders(<App />, { route: route(s) });
    await screen.findByText("5 à acheter");
    act(() => {
      setOnline(false);
    });
    await user.click(screen.getByRole("checkbox", { name: "Lait" }));
    cleanup();
    act(() => {
      setOnline(true);
    });

    renderWithProviders(<App />, { route: route(s) });
    expect(await screen.findByRole("checkbox", { name: "Lait" })).toBeChecked();
    await waitFor(() => {
      expect(s.shop.patches).toEqual([
        { itemId: idOf(s, "Lait"), checked: true, checkedChangedAt: expect.any(String) },
      ]);
    });
  });
});
