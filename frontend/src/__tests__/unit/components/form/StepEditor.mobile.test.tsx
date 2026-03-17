import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import StepEditor from "../../../../components/form/StepEditor";

const mockUseIsMobile = vi.fn();
vi.mock("../../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe("StepEditor mobile layout", () => {
  it("should render all controls on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <StepEditor
        value={[{ instruction: "Step one" }, { instruction: "Step two" }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Step one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step two")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Move up")).toHaveLength(2);
    expect(screen.getAllByLabelText("Move down")).toHaveLength(2);
    expect(screen.getAllByLabelText("Remove step")).toHaveLength(2);
    expect(screen.getAllByLabelText("Drag to reorder")).toHaveLength(2);
  });

  it("should have 44px touch targets on buttons on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<StepEditor value={[{ instruction: "Step one" }]} onChange={vi.fn()} />);

    const dragHandle = screen.getByLabelText("Drag to reorder");
    expect(dragHandle.className).toContain("min-h-[44px]");

    const moveUp = screen.getByLabelText("Move up");
    expect(moveUp.className).toContain("min-h-[44px]");
  });

  it("should use btn-xs on desktop (no 44px override)", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<StepEditor value={[{ instruction: "Step one" }]} onChange={vi.fn()} />);

    const dragHandle = screen.getByLabelText("Drag to reorder");
    expect(dragHandle.className).toContain("btn-xs");
    expect(dragHandle.className).not.toContain("min-h-[44px]");
  });
});
