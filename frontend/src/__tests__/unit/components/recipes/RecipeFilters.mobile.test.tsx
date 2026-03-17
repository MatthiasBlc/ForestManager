import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../../setup/testUtils";
import RecipeFilters from "../../../../components/recipes/RecipeFilters";
import { setUserAuthenticated, resetAuthState } from "../../../setup/mswHandlers";

// Mock useIsMobile
const mockUseIsMobile = vi.fn();
vi.mock("../../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe("RecipeFilters mobile layout", () => {
  const mockOnSearchChange = vi.fn();
  const mockOnTagsChange = vi.fn();
  const mockOnIngredientsChange = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    setUserAuthenticated(true);
  });

  const defaultProps = {
    search: "",
    tags: [],
    ingredients: [],
    onSearchChange: mockOnSearchChange,
    onTagsChange: mockOnTagsChange,
    onIngredientsChange: mockOnIngredientsChange,
    onReset: mockOnReset,
  };

  it("should show collapsible filter button on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.getByText("Filtres")).toBeInTheDocument();
  });

  it("should not show collapsible filter button on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.queryByText("Filtres")).not.toBeInTheDocument();
  });

  it("should hide filter fields by default on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.queryByText("Filter by tags")).not.toBeInTheDocument();
    expect(screen.queryByText("Filter by ingredients")).not.toBeInTheDocument();
  });

  it("should expand filter fields when clicking Filtres button", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const user = userEvent.setup();
    render(<RecipeFilters {...defaultProps} />);

    await user.click(screen.getByText("Filtres"));

    expect(screen.getByText("Filter by tags")).toBeInTheDocument();
    expect(screen.getByText("Filter by ingredients")).toBeInTheDocument();
  });

  it("should collapse filter fields when clicking Filtres button again", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const user = userEvent.setup();
    render(<RecipeFilters {...defaultProps} />);

    await user.click(screen.getByText("Filtres"));
    expect(screen.getByText("Filter by tags")).toBeInTheDocument();

    await user.click(screen.getByText("Filtres"));
    expect(screen.queryByText("Filter by tags")).not.toBeInTheDocument();
  });

  it("should show active filter count badge when filters are active", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<RecipeFilters {...defaultProps} tags={["dessert"]} ingredients={["sugar"]} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should not show badge when no filters are active", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<RecipeFilters {...defaultProps} />);

    // No badge should be rendered
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should show inline filters on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.getByText("Filter by tags")).toBeInTheDocument();
    expect(screen.getByText("Filter by ingredients")).toBeInTheDocument();
  });
});
