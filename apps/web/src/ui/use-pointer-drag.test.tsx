// Glisser au pointeur [D204] : un seul code pour la souris et le doigt. Souris : le
// glisser part apres quelques pixels. Doigt : appui long, la case se souleve ; si le
// doigt bouge, glisser ; sinon le menu au relachement. Echap, relacher hors d'une cible
// ou sur la case d'origine : rien.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePointerDrag } from "./use-pointer-drag.ts";

const onDrop = vi.fn<(source: string, target: string) => void>();
const onMenu = vi.fn<(id: string) => void>();
const onClick = vi.fn<(id: string) => void>();

function Harness() {
  const drag = usePointerDrag({ onDrop });
  return (
    <div>
      {["a", "b"].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onClick(id);
          }}
          {...drag.target(id)}
          {...drag.source(id, {
            onMenu: () => {
              onMenu(id);
            },
          })}
        >
          {id}
        </button>
      ))}
      <p>dehors</p>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
  onDrop.mockReset();
  onMenu.mockReset();
  onClick.mockReset();
});

const ghost = () => document.querySelector(".fm-drag-ghost");
const mouse = { pointerType: "mouse", button: 0 } as const;
const touch = { pointerType: "touch", button: 0 } as const;

describe("souris", () => {
  it("glisser une case sur une autre : case soulevee, cible eclairee, puis echange", () => {
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { ...mouse, clientX: 12, clientY: 11 });
    expect(ghost()).toBeNull();
    fireEvent.pointerMove(b, { ...mouse, clientX: 40, clientY: 60 });
    expect(ghost()).not.toBeNull();
    expect(ghost()).toHaveAttribute("aria-hidden", "true");
    expect(a).toHaveAttribute("data-drag-source");
    expect(b).toHaveAttribute("data-drop-over");
    fireEvent.pointerUp(b, { ...mouse, clientX: 40, clientY: 60 });
    expect(onDrop).toHaveBeenCalledWith("a", "b");
    expect(ghost()).toBeNull();
    expect(a).not.toHaveAttribute("data-drag-source");
    expect(b).not.toHaveAttribute("data-drop-over");
    // Le clic qui suit un glisser ne compte pas.
    fireEvent.click(a);
    expect(onClick).not.toHaveBeenCalled();
    // Le clic suivant, si.
    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.click(a);
    expect(onClick).toHaveBeenCalledWith("a");
  });

  it("un clic sans bouger reste un clic", () => {
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(a, { ...mouse, clientX: 11, clientY: 10 });
    fireEvent.click(a);
    expect(onClick).toHaveBeenCalledWith("a");
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("Echap, relacher dehors ou sur la case d'origine : rien", () => {
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(b, { ...mouse, clientX: 40, clientY: 60 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(ghost()).toBeNull();
    expect(b).not.toHaveAttribute("data-drop-over");
    fireEvent.pointerUp(b, { ...mouse, clientX: 40, clientY: 60 });

    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(screen.getByText("dehors"), { ...mouse, clientX: 90, clientY: 90 });
    fireEvent.pointerUp(screen.getByText("dehors"), { ...mouse, clientX: 90, clientY: 90 });

    fireEvent.pointerDown(a, { ...mouse, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { ...mouse, clientX: 30, clientY: 10 });
    fireEvent.pointerUp(a, { ...mouse, clientX: 30, clientY: 10 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(ghost()).toBeNull();
  });

  it("clic droit (ou touche Menu) : le menu", () => {
    render(<Harness />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "b" }));
    expect(onMenu).toHaveBeenCalledWith("b");
  });

  it("le bouton droit ne lance pas de glisser", () => {
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    fireEvent.pointerDown(a, { pointerType: "mouse", button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { ...mouse, clientX: 60, clientY: 60 });
    expect(ghost()).toBeNull();
  });
});

describe("doigt", () => {
  it("bouger avant l'appui long : la page defile, pas de glisser", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    fireEvent.pointerDown(a, { ...touch, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { ...touch, clientX: 10, clientY: 40 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(a).not.toHaveAttribute("data-drag-lifted");
    fireEvent.pointerMove(b, { ...touch, clientX: 40, clientY: 80 });
    fireEvent.pointerUp(b, { ...touch, clientX: 40, clientY: 80 });
    expect(ghost()).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
  });

  it("appui long sans bouger : la case se souleve, le menu s'ouvre au relachement", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    fireEvent.pointerDown(a, { ...touch, clientX: 10, clientY: 10 });
    // Le menu contextuel natif de l'appui long est ignore.
    fireEvent.contextMenu(a);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(a).toHaveAttribute("data-drag-lifted");
    expect(onMenu).not.toHaveBeenCalled();
    fireEvent.pointerUp(a, { ...touch, clientX: 12, clientY: 11 });
    expect(onMenu).toHaveBeenCalledWith("a");
    expect(a).not.toHaveAttribute("data-drag-lifted");
    fireEvent.click(a);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("appui long puis glisser : echange", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    fireEvent.pointerDown(a, { ...touch, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerMove(b, { ...touch, clientX: 40, clientY: 80 });
    expect(ghost()).not.toBeNull();
    expect(b).toHaveAttribute("data-drop-over");
    fireEvent.pointerUp(b, { ...touch, clientX: 40, clientY: 80 });
    expect(onDrop).toHaveBeenCalledWith("a", "b");
    expect(onMenu).not.toHaveBeenCalled();
  });

  it("geste interrompu par le navigateur : annule", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    fireEvent.pointerDown(a, { ...touch, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerMove(b, { ...touch, clientX: 40, clientY: 80 });
    fireEvent.pointerCancel(b, { ...touch });
    expect(ghost()).toBeNull();
    fireEvent.pointerUp(b, { ...touch, clientX: 40, clientY: 80 });
    expect(onDrop).not.toHaveBeenCalled();
  });
});
