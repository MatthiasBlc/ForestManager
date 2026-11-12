import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Avatar, Badge, EmptyState, Skeleton } from "./display.tsx";
import { Button, IconButton } from "./button.tsx";
import { Chip, RadioGroup, SegmentedControl, Stepper, Switch, TintPicker } from "./controls.tsx";
import { Field } from "./field.tsx";
import { Icon } from "./icon.tsx";
import { OptionList } from "./option-list.tsx";

describe("Icon", () => {
  it("decorative par defaut, image nommee avec un label", () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    render(<Icon name="bell" label="Notifications" />);
    expect(screen.getByRole("img", { name: "Notifications" })).toBeInTheDocument();
  });
});

describe("Button et IconButton", () => {
  it("bouton secondaire par defaut, variante et pleine largeur, type button", async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Annuler</Button>
        <Button variant="primary" block icon="plus">
          Nouvelle recette
        </Button>
      </>
    );
    const cancel = screen.getByRole("button", { name: "Annuler" });
    expect(cancel).toHaveClass("fm-btn", "fm-btn-secondary");
    expect(cancel).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Nouvelle recette" })).toHaveClass(
      "fm-btn-primary",
      "fm-btn-block"
    );
    await userEvent.click(cancel);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("type submit possible dans un formulaire", () => {
    render(<Button type="submit">Créer</Button>);
    expect(screen.getByRole("button", { name: "Créer" })).toHaveAttribute("type", "submit");
  });

  it("IconButton : nom accessible obligatoire, compteur plafonne a 99+", () => {
    render(<IconButton icon="bell" label="Notifications" count={120} />);
    const button = screen.getByRole("button", { name: "Notifications" });
    expect(within(button).getByText("99+")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("relie libelle, aide et erreur au champ", () => {
    render(
      <>
        <Field label="Nom de l'espace" hint="3 caractères minimum" />
        <Field label="Email" error="Adresse invalide" />
      </>
    );
    const name = screen.getByLabelText("Nom de l'espace");
    expect(name).toHaveAccessibleDescription("3 caractères minimum");
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Adresse invalide");
  });

  it("zone de texte en multiligne, attributs transmis", async () => {
    render(<Field label="Description" multiline placeholder="Pour qui ?" />);
    const area = screen.getByLabelText("Description");
    expect(area.tagName).toBe("TEXTAREA");
    await userEvent.type(area, "Chez nous");
    expect(area).toHaveValue("Chez nous");
  });
});

describe("controles", () => {
  it("Switch : interrupteur nomme, bascule et previent", async () => {
    const onChange = vi.fn();
    render(<Switch label="Rester connecté" onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Rester connecté" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Stepper : bornes respectees", async () => {
    const onChange = vi.fn();
    render(
      <Stepper label="Portions" min={1} max={2} defaultValue={1} unit="pers." onChange={onChange} />
    );
    expect(screen.getByRole("button", { name: "Moins" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Plus" }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("2 pers.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plus" })).toBeDisabled();
  });

  it("SegmentedControl : une option pressee", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Inviter par"
        options={[
          { value: "link", label: "Lien" },
          { value: "username", label: "Nom d'utilisateur" },
        ]}
        onChange={onChange}
      />
    );
    expect(screen.getByRole("button", { name: "Lien" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Nom d'utilisateur" }));
    expect(onChange).toHaveBeenCalledWith("username");
    expect(screen.getByRole("button", { name: "Lien" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Chip : selection a bascule", async () => {
    render(<Chip>Végétarien</Chip>);
    const chip = screen.getByRole("button", { name: "Végétarien" });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("RadioGroup : un choix, option desactivee", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Durée du lien"
        options={[
          { value: "1", label: "1 jour" },
          { value: "7", label: "7 jours", hint: "Recommandé" },
          { value: "30", label: "30 jours", disabled: true },
        ]}
        defaultValue="7"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("radio", { name: /7 jours/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /30 jours/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /1 jour/ }));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("TintPicker : cinq teintes, choix au clic et au clavier", async () => {
    const onChange = vi.fn();
    render(<TintPicker defaultValue={2} onChange={onChange} />);
    const group = screen.getByRole("radiogroup", { name: "Teinte de l'espace" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(radios[3]!);
    expect(onChange).toHaveBeenLastCalledWith(4);
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});

describe("affichage", () => {
  it("Badge avec ton, Avatar en initiales nomme", () => {
    render(
      <>
        <Badge tone="danger">Supprimé</Badge>
        <Avatar name="Léa Martin" />
      </>
    );
    expect(screen.getByText("Supprimé")).toHaveClass("fm-badge", "fm-badge-danger");
    const avatar = screen.getByRole("img", { name: "Léa Martin" });
    expect(avatar).toHaveTextContent("LM");
  });

  it("EmptyState : titre, texte, action", () => {
    render(
      <EmptyState title="Aucune recette" action={<Button>Ajouter une recette</Button>}>
        Ajoute ta première recette.
      </EmptyState>
    );
    expect(screen.getByRole("heading", { name: "Aucune recette" })).toBeInTheDocument();
    expect(screen.getByText("Ajoute ta première recette.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter une recette" })).toBeInTheDocument();
  });

  it("Skeleton : annonce le chargement", () => {
    render(<Skeleton kind="card" count={2} />);
    expect(screen.getByRole("status", { name: "Chargement…" })).toBeInTheDocument();
  });
});

describe("OptionList", () => {
  const options = [
    { value: "a", label: "Famille", hint: "6 membres" },
    { value: "b", label: "Colloc" },
  ];

  it("un seul choix", async () => {
    const onChange = vi.fn();
    render(<OptionList label="Espace" options={options} onChange={onChange} />);
    await userEvent.click(screen.getByRole("option", { name: /Famille/ }));
    expect(onChange).toHaveBeenCalledWith("a");
    expect(screen.getByRole("option", { name: /Famille/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("plusieurs choix", async () => {
    const onChange = vi.fn();
    render(<OptionList label="Espaces" multiple options={options} onChange={onChange} />);
    await userEvent.click(screen.getByRole("option", { name: /Famille/ }));
    await userEvent.click(screen.getByRole("option", { name: /Colloc/ }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  });
});
