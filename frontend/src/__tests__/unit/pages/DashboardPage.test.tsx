import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "../../setup/testUtils";
import DashboardPage from "../../../pages/DashboardPage";
import { setUserAuthenticated, resetAuthState } from "../../setup/mswHandlers";

describe("DashboardPage", () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it("should show loading spinners initially", () => {
    render(<DashboardPage />);
    const spinners = document.querySelectorAll(".loading-spinner");
    expect(spinners.length).toBeGreaterThan(0);
  });

  it("should display 'My Communities' section title", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("My Communities")).toBeInTheDocument();
  });

  it("should display 'My Recipes' section title", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("My Recipes")).toBeInTheDocument();
  });

  it("should display 'Recent Activity' section title", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("should show community data after loading", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Baking Club").length).toBeGreaterThan(0);
    });
  });

  it("should show recipe data after loading", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Test Recipe").length).toBeGreaterThan(0);
    });
  });

  it("should show 'New Community' button", () => {
    render(<DashboardPage />);
    expect(screen.getByText("New Community")).toBeInTheDocument();
  });

  it("should show 'New Recipe' button", () => {
    render(<DashboardPage />);
    expect(screen.getByText("New Recipe")).toBeInTheDocument();
  });
});
