import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithUserAuth } from "../../setup/testUtils";
import ChangelogPage from "../../../pages/ChangelogPage";
import { setUserAuthenticated, resetAuthState } from "../../setup/mswHandlers";

describe("ChangelogPage", () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it("should show loading spinner initially", () => {
    renderWithUserAuth(<ChangelogPage />);
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("should display page title", async () => {
    renderWithUserAuth(<ChangelogPage />);

    await waitFor(() => {
      expect(screen.getByText("Changelog")).toBeInTheDocument();
    });
  });

  it("should display changelog entries after loading", async () => {
    renderWithUserAuth(<ChangelogPage />);

    await waitFor(() => {
      expect(screen.getByText("2 nouveautes et 1 correction")).toBeInTheDocument();
      expect(screen.getByText("1 nouveaute et 2 ameliorations")).toBeInTheDocument();
      expect(screen.getByText("Lancement de Forest Manager")).toBeInTheDocument();
    });
  });

  it("should display version badges", async () => {
    renderWithUserAuth(<ChangelogPage />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
      expect(screen.getByText("v1.1.0")).toBeInTheDocument();
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    });
  });

  it("should display category sections with items", async () => {
    renderWithUserAuth(<ChangelogPage />);

    await waitFor(() => {
      // Features from v1.2.0
      expect(screen.getByText("Import de recettes depuis URL")).toBeInTheDocument();
      expect(screen.getByText("Systeme de notifications")).toBeInTheDocument();

      // Fix from v1.2.0
      expect(screen.getByText("Correction de l'affichage mobile")).toBeInTheDocument();

      // Improvements from v1.1.0
      expect(screen.getByText("Performance amelioree")).toBeInTheDocument();
    });
  });

  it("should display category headers", async () => {
    renderWithUserAuth(<ChangelogPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Nouveautes").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Corrections").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Ameliorations").length).toBeGreaterThan(0);
    });
  });
});
