import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ActionMenu } from "./action-menu.tsx";
import { Button } from "./button.tsx";
import { Sheet, SheetFooter } from "./sheet.tsx";
import { ToastProvider } from "./toast.tsx";
import { useToast } from "./use-toast.ts";

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Inviter</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Inviter des membres">
        <p>Contenu</p>
        <SheetFooter>
          <Button variant="primary">Créer le lien</Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("dialogue modal titre, ferme par la croix et par Echap, rend le focus", async () => {
    const user = userEvent.setup();
    render(<SheetDemo />);
    const trigger = screen.getByRole("button", { name: "Inviter" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Inviter des membres" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer le lien" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ActionMenu", () => {
  it("s'ouvre depuis son declencheur et renvoie l'action choisie", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ActionMenu
        label="Actions du membre"
        trigger={<Button>Options</Button>}
        items={[
          { id: "promote", label: "Promouvoir", icon: "shield" },
          "-",
          { id: "exclude", label: "Exclure", icon: "trash", danger: true },
        ]}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("menu", { name: "Actions du membre" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Exclure" }));
    expect(onSelect).toHaveBeenCalledWith("exclude");
  });
});

function ToastDemo() {
  const toast = useToast();
  return <Button onClick={() => toast("Espace créé", { tone: "success" })}>Créer</Button>;
}

describe("Toast", () => {
  it("annonce une confirmation", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "Créer" }));
    expect(await screen.findByText("Espace créé")).toBeInTheDocument();
  });
});
