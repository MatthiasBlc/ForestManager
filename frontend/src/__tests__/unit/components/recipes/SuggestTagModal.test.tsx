import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../../setup/testUtils";
import SuggestTagModal from "../../../../components/recipes/SuggestTagModal";
import { setUserAuthenticated } from "../../../setup/mswHandlers";

describe("SuggestTagModal", () => {
  const defaultProps = {
    recipeId: "test-recipe-id",
    onClose: vi.fn(),
    onSuggestionSubmitted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setUserAuthenticated(true);
  });

  it("should render modal with tag selector and buttons", () => {
    render(<SuggestTagModal {...defaultProps} />);

    expect(screen.getByText("Suggest a tag")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search or create a tag...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /suggest tag/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("should disable submit when no tag selected", () => {
    render(<SuggestTagModal {...defaultProps} />);

    expect(screen.getByRole("button", { name: /suggest tag/i })).toBeDisabled();
  });

  it("should enable submit when a tag is added", async () => {
    const user = userEvent.setup();
    render(<SuggestTagModal {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search or create a tag...");
    await user.type(input, "vegan{Enter}");

    expect(screen.getByRole("button", { name: /suggest tag/i })).toBeEnabled();
  });

  it("should submit suggestion and call onSuggestionSubmitted", async () => {
    const user = userEvent.setup();
    render(<SuggestTagModal {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search or create a tag...");
    await user.type(input, "vegan{Enter}");
    await user.click(screen.getByRole("button", { name: /suggest tag/i }));

    await waitFor(() => {
      expect(defaultProps.onSuggestionSubmitted).toHaveBeenCalledTimes(1);
    });
  });

  it("should show error on 409 conflict", async () => {
    const user = userEvent.setup();
    render(<SuggestTagModal {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search or create a tag...");
    await user.type(input, "duplicate{Enter}");
    await user.click(screen.getByRole("button", { name: /suggest tag/i }));

    await waitFor(() => {
      expect(screen.getByText("Ce tag a deja ete suggere sur cette recette")).toBeInTheDocument();
    });
    expect(defaultProps.onSuggestionSubmitted).not.toHaveBeenCalled();
  });

  it("should call onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<SuggestTagModal {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
