import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "../../../../components/mobile/BottomSheet";

describe("BottomSheet", () => {
  it("should render children when open", () => {
    render(
      <BottomSheet isOpen onClose={vi.fn()}>
        <p>Sheet content</p>
      </BottomSheet>
    );
    expect(screen.getByText("Sheet content")).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <BottomSheet isOpen={false} onClose={vi.fn()}>
        <p>Sheet content</p>
      </BottomSheet>
    );
    expect(screen.queryByText("Sheet content")).not.toBeInTheDocument();
  });

  it("should render title when provided", () => {
    render(
      <BottomSheet isOpen onClose={vi.fn()} title="My Title">
        <p>content</p>
      </BottomSheet>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("should render close button when title is provided", () => {
    render(
      <BottomSheet isOpen onClose={vi.fn()} title="Title">
        <p>content</p>
      </BottomSheet>
    );
    expect(screen.getByLabelText("Fermer")).toBeInTheDocument();
  });

  it("should call onClose when overlay is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet isOpen onClose={onClose}>
        <p>content</p>
      </BottomSheet>
    );

    // Click the overlay (first child with aria-hidden)
    const overlay = document.querySelector("[aria-hidden='true']");
    expect(overlay).toBeTruthy();
    await user.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet isOpen onClose={onClose} title="Title">
        <p>content</p>
      </BottomSheet>
    );

    await user.click(screen.getByLabelText("Fermer"));
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet isOpen onClose={onClose}>
        <p>content</p>
      </BottomSheet>
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("should lock body scroll when open", () => {
    const { unmount } = render(
      <BottomSheet isOpen onClose={vi.fn()}>
        <p>content</p>
      </BottomSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("should have role dialog and aria-modal", () => {
    render(
      <BottomSheet isOpen onClose={vi.fn()}>
        <p>content</p>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
