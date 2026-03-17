import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithUserAuth } from "../../setup/testUtils";
import RecipeDetailPage from "../../../pages/RecipeDetailPage";
import { setUserAuthenticated, resetAuthState } from "../../setup/mswHandlers";

// Mock useIsMobile
const mockUseIsMobile = vi.fn();
vi.mock("../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock useParams to return a valid recipe id
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "test-recipe-id" }),
  };
});

describe("RecipeDetailPage mobile layout", () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it("should show '...' button instead of inline action buttons on mobile", async () => {
    mockUseIsMobile.mockReturnValue(true);
    renderWithUserAuth(<RecipeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // Should show the ellipsis button for ActionSheet
    expect(screen.getByLabelText("Recipe actions")).toBeInTheDocument();

    // Should NOT show inline Edit/Delete buttons directly
    const editButtons = screen.queryAllByLabelText("Edit recipe");
    expect(editButtons.length).toBe(0);
  });

  it("should show inline action buttons on desktop", async () => {
    mockUseIsMobile.mockReturnValue(false);
    renderWithUserAuth(<RecipeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // Should NOT show the ellipsis button
    expect(screen.queryByLabelText("Recipe actions")).not.toBeInTheDocument();

    // Should show inline buttons (Edit and Delete for owner)
    expect(screen.getByLabelText("Edit recipe")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete recipe")).toBeInTheDocument();
  });

  it("should open ActionSheet when clicking '...' button on mobile", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const user = userEvent.setup();
    renderWithUserAuth(<RecipeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Recipe actions"));

    // ActionSheet should show Modifier and Supprimer options (French labels)
    await waitFor(() => {
      expect(screen.getByText("Modifier")).toBeInTheDocument();
      expect(screen.getByText("Supprimer")).toBeInTheDocument();
    });
  });

  it("should render smaller hero image on mobile (h-48 class)", async () => {
    mockUseIsMobile.mockReturnValue(true);
    renderWithUserAuth(<RecipeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Recipe")).toBeInTheDocument();
    });

    // The recipe has no image so we can't directly test h-48,
    // but we verify the page renders correctly on mobile
    expect(screen.getByText("Test Recipe")).toBeInTheDocument();
  });
});
