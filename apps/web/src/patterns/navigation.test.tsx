import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { SpaceRail } from "./space-rail.tsx";
import { TabBar } from "./tab-bar.tsx";
import { TopBar } from "./top-bar.tsx";

const items = ["a", "b", "c", "d", "e"].map((id) => ({
  id,
  label: `Module ${id}`,
  icon: "book-open" as const,
  to: `/s/x/${id}`,
}));

describe("TabBar (D131)", () => {
  it("4 onglets puis Plus ; Plus actif quand la page est au-dela", async () => {
    const onMore = vi.fn();
    render(
      <MemoryRouter>
        <TabBar items={items} activeId="e" onMore={onMore} />
      </MemoryRouter>
    );
    const nav = screen.getByRole("navigation", { name: "Navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Module a",
      "Module b",
      "Module c",
      "Module d",
    ]);
    const more = within(nav).getByRole("button", { name: "Plus" });
    expect(more).toHaveAttribute("aria-current", "page");
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });

  it("onglet courant marque", () => {
    render(
      <MemoryRouter>
        <TabBar items={items.slice(0, 2)} activeId="b" onMore={() => undefined} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Module b" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Plus" })).not.toHaveAttribute("aria-current");
  });
});

describe("SpaceRail", () => {
  it("perso d'abord, groupes, suppression programmee lisible, ajout", async () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn();
    render(
      <SpaceRail
        personal={{ id: "p", name: "matthias" }}
        spaces={[
          { id: "f", name: "Famille", tint: 1, unread: true },
          { id: "t", name: "TOM", tint: 3, deleting: { daysLeft: 12 } },
        ]}
        activeId="f"
        onSelect={onSelect}
        onAdd={onAdd}
      />
    );
    const rail = screen.getByRole("navigation", { name: "Espaces" });
    const buttons = within(rail).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "matthias",
      "Famille, nouveautés",
      "TOM, suppression dans 12 jours",
      "Créer ou rejoindre un espace",
    ]);
    expect(buttons[1]).toHaveAttribute("aria-current", "true");
    await userEvent.click(buttons[2]!);
    expect(onSelect).toHaveBeenCalledWith("t");
    await userEvent.click(buttons[3]!);
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("TopBar", () => {
  it("bouton d'espace qui ouvre le selecteur, retour, profil", async () => {
    const onSpace = vi.fn();
    render(
      <MemoryRouter>
        <TopBar
          title="Recettes"
          space={{ id: "f", name: "Famille", tint: 1 }}
          onSpace={onSpace}
          user={{ name: "matthias", to: "/profile" }}
        />
      </MemoryRouter>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Changer d'espace, espace courant : Famille" })
    );
    expect(onSpace).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Profil de matthias" })).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("mode edition (D136) : Annuler, titre, action principale", async () => {
    const onCancel = vi.fn();
    const onAction = vi.fn();
    render(<TopBar title="Nouvel espace" onCancel={onCancel} action="Créer" onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await userEvent.click(screen.getByRole("button", { name: "Créer" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledOnce();
  });
});
