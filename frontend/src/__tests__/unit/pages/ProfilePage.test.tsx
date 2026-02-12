import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "../../setup/testUtils";
import ProfilePage from "../../../pages/ProfilePage";
import { setUserAuthenticated, resetAuthState } from "../../setup/mswHandlers";

describe("ProfilePage", () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it("should render page title", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeInTheDocument();
    });
  });

  it("should render Account Information section", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Account Information")).toBeInTheDocument();
    });
  });

  it("should render Change Password section", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Change Password")).toBeInTheDocument();
    });
  });

  it("should render username label", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Username")).toBeInTheDocument();
    });
  });

  it("should render email label", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Email")).toBeInTheDocument();
    });
  });

  it("should render Save changes button", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Save changes").length).toBeGreaterThan(0);
    });
  });

  it("should render Change password button", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Change password").length).toBeGreaterThan(0);
    });
  });

  it("should render password fields", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Current password")).toBeInTheDocument();
      expect(screen.getByText("New password")).toBeInTheDocument();
      expect(screen.getByText("Confirm new password")).toBeInTheDocument();
    });
  });
});
