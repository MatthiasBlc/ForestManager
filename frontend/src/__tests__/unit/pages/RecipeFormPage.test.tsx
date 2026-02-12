import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../../setup/testUtils";
import RecipeFormPage from "../../../pages/RecipeFormPage";

describe("RecipeFormPage", () => {
  it("should render 'New Recipe' title in creation mode", () => {
    render(<RecipeFormPage />);
    expect(screen.getByText("New Recipe")).toBeInTheDocument();
  });

  it("should render without errors", () => {
    const { container } = render(<RecipeFormPage />);
    expect(container).toBeTruthy();
  });
});
