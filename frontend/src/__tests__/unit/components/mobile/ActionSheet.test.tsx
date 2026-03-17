import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionSheet from "../../../../components/mobile/ActionSheet";
import type { ActionItem } from "../../../../components/mobile/ActionSheet";

const mockItems: ActionItem[] = [
  { label: "Modifier", onClick: vi.fn() },
  { label: "Partager", onClick: vi.fn() },
  { label: "Supprimer", onClick: vi.fn(), destructive: true },
];

describe("ActionSheet", () => {
  it("should render all action items", () => {
    render(<ActionSheet isOpen onClose={vi.fn()} items={mockItems} />);
    expect(screen.getByText("Modifier")).toBeInTheDocument();
    expect(screen.getByText("Partager")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();
  });

  it("should render cancel button", () => {
    render(<ActionSheet isOpen onClose={vi.fn()} items={mockItems} />);
    expect(screen.getByText("Annuler")).toBeInTheDocument();
  });

  it("should call item onClick and close on item click", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ActionSheet isOpen onClose={onClose} items={mockItems} />);

    await user.click(screen.getByText("Modifier"));
    expect(mockItems[0].onClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ActionSheet isOpen onClose={onClose} items={mockItems} />);

    await user.click(screen.getByText("Annuler"));
    expect(onClose).toHaveBeenCalled();
  });

  it("should apply destructive style to destructive items", () => {
    render(<ActionSheet isOpen onClose={vi.fn()} items={mockItems} />);
    const deleteButton = screen.getByText("Supprimer").closest("button");
    expect(deleteButton?.className).toContain("text-error");
  });

  it("should not render when closed", () => {
    render(<ActionSheet isOpen={false} onClose={vi.fn()} items={mockItems} />);
    expect(screen.queryByText("Modifier")).not.toBeInTheDocument();
  });

  it("should render icons when provided", () => {
    const itemsWithIcon: ActionItem[] = [
      { label: "Edit", icon: <span data-testid="edit-icon">E</span>, onClick: vi.fn() },
    ];
    render(<ActionSheet isOpen onClose={vi.fn()} items={itemsWithIcon} />);
    expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
  });
});
