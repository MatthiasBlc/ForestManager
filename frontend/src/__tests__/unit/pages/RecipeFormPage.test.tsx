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

  it("should render servings field with default value 4", () => {
    render(<RecipeFormPage />);
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getByText("Servings *")).toBeInTheDocument();
  });

  it("should render time fields", () => {
    render(<RecipeFormPage />);
    expect(screen.getByText("Times (optional, in minutes)")).toBeInTheDocument();
    expect(screen.getByText("Prep")).toBeInTheDocument();
    expect(screen.getByText("Cook")).toBeInTheDocument();
    expect(screen.getByText("Rest")).toBeInTheDocument();
  });

  it("should render steps section with add button", () => {
    render(<RecipeFormPage />);
    expect(screen.getByText("Steps *")).toBeInTheDocument();
    expect(screen.getByText("Ajouter une etape")).toBeInTheDocument();
  });
});
