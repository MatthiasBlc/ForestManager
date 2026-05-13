import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render } from "@testing-library/react";
import { AdminAuthProvider } from "../../../../contexts/AdminAuthContext";
import AdminChangelogPage from "../../../../pages/admin/AdminChangelogPage";
import { setAdminAuthenticated, resetAuthState } from "../../../setup/mswHandlers";
import { Toaster } from "react-hot-toast";

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/admin/changelog"]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/changelog" element={<AdminChangelogPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe("AdminChangelogPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it("should render page title", async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("Changelog")).toBeInTheDocument();
    });
  });

  it("should display changelog entries", async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("2 nouveautes et 1 correction")).toBeInTheDocument();
      expect(screen.getByText("1 nouveaute et 2 ameliorations")).toBeInTheDocument();
    });
  });

  it("should display version badges", async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
      expect(screen.getByText("v1.1.0")).toBeInTheDocument();
    });
  });

  it("should show Active status badges", async () => {
    render(<TestApp />);

    await waitFor(() => {
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges.length).toBe(2);
    });
  });

  it("should not show deleted entries by default", async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    });

    expect(screen.queryByText("v0.9.0")).not.toBeInTheDocument();
  });

  it("should show deleted entries when checkbox is toggled", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Show deleted"));

    await waitFor(() => {
      expect(screen.getByText("v0.9.0")).toBeInTheDocument();
      expect(screen.getByText("Deleted")).toBeInTheDocument();
    });
  });

  it("should open create modal when New Entry is clicked", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("New Entry"));

    expect(screen.getByText("New Changelog Entry")).toBeInTheDocument();
  });

  it("should open edit modal when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    await user.click(editButtons[0]);

    expect(screen.getByText("Edit Changelog Entry")).toBeInTheDocument();
  });

  it("should show delete confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Delete v1.2.0/)).toBeInTheDocument();
    });
  });

  it("should display New Entry button", async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });
  });
});
