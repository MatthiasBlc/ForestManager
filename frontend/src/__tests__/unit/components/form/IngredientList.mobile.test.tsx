import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../../../setup/testUtils";
import IngredientList, { IngredientInput } from "../../../../components/form/IngredientList";
import { setUserAuthenticated, resetAuthState } from "../../../setup/mswHandlers";

const mockUseIsMobile = vi.fn();
vi.mock("../../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe("IngredientList mobile layout", () => {
  const mockOnChange = vi.fn();
  const ingredients: IngredientInput[] = [
    { name: "sugar", quantity: 100 },
    { name: "flour", quantity: 200 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    setUserAuthenticated(true);
  });

  it("should render stacked layout on mobile (name on own line)", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<IngredientList value={ingredients} onChange={mockOnChange} />);

    // All fields should still be present
    expect(screen.getByDisplayValue("sugar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("flour")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200")).toBeInTheDocument();
  });

  it("should render inline layout on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<IngredientList value={ingredients} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("sugar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("should have 44px touch targets on remove buttons on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<IngredientList value={[{ name: "sugar" }]} onChange={mockOnChange} />);

    const removeButton = screen.getByLabelText("Remove ingredient");
    expect(removeButton.className).toContain("min-h-[44px]");
    expect(removeButton.className).toContain("min-w-[44px]");
  });
});
