import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import ProposeModificationModal from "../../../../components/proposals/ProposeModificationModal";
import { setUserAuthenticated, resetAuthState } from "../../../setup/mswHandlers";
import { RecipeIngredient } from "../../../../models/recipe";

const mockUseIsMobile = vi.fn();
vi.mock("../../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

const mockIngredients: RecipeIngredient[] = [
  {
    id: "ri-1",
    name: "sugar",
    ingredientId: "ing-1",
    quantity: 100,
    unitId: "unit-1",
    unit: { id: "unit-1", name: "gramme", abbreviation: "g" },
    order: 0,
  },
];

describe("ProposeModificationModal mobile layout", () => {
  const defaultProps = {
    recipeId: "test-recipe-id",
    currentTitle: "Original Title",
    currentSteps: [{ id: "step-1", order: 0, instruction: "Original content" }],
    currentServings: 4,
    currentPrepTime: 15 as number | null,
    currentCookTime: 30 as number | null,
    currentRestTime: null as number | null,
    currentIngredients: mockIngredients,
    onClose: vi.fn(),
    onProposalSubmitted: vi.fn(),
  };

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    vi.clearAllMocks();
  });

  it("should render fullscreen on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<ProposeModificationModal {...defaultProps} />);

    // The modal-box should have fullscreen classes
    const modalBox = screen.getByText("Propose a modification").closest(".modal-box");
    expect(modalBox?.className).toContain("!w-full");
    expect(modalBox?.className).toContain("!h-full");
    expect(modalBox?.className).toContain("!rounded-none");
  });

  it("should render normal modal on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<ProposeModificationModal {...defaultProps} />);

    const modalBox = screen.getByText("Propose a modification").closest(".modal-box");
    expect(modalBox?.className).not.toContain("!w-full");
    expect(modalBox?.className).not.toContain("!rounded-none");
  });

  it("should push history state on mobile for back button support", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    mockUseIsMobile.mockReturnValue(true);
    render(<ProposeModificationModal {...defaultProps} />);

    expect(pushStateSpy).toHaveBeenCalledWith({ modal: "propose" }, "");
    pushStateSpy.mockRestore();
  });
});
