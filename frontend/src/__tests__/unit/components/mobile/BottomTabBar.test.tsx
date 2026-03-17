import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithUserAuth } from "../../../setup/testUtils";
import BottomTabBar from "../../../../components/mobile/BottomTabBar";

// Mock useKeyboardVisible
vi.mock("../../../../hooks/useKeyboardVisible", () => ({
  useKeyboardVisible: vi.fn(() => false),
}));

// Mock useUnreadCount
vi.mock("../../../../hooks/useUnreadCount", () => ({
  useUnreadCount: vi.fn(() => ({ count: 0, byCategory: {}, loading: false, refresh: vi.fn() })),
}));

import { useKeyboardVisible } from "../../../../hooks/useKeyboardVisible";
import { useUnreadCount } from "../../../../hooks/useUnreadCount";

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("BottomTabBar", () => {
  beforeEach(() => {
    vi.mocked(useKeyboardVisible).mockReturnValue(false);
    vi.mocked(useUnreadCount).mockReturnValue({
      count: 0,
      byCategory: {},
      loading: false,
      refresh: vi.fn(),
    });
    mockedNavigate.mockClear();
  });

  it("should render 4 tabs", () => {
    renderWithUserAuth(<BottomTabBar />);
    expect(screen.getByLabelText("Accueil")).toBeInTheDocument();
    expect(screen.getByLabelText("Recettes")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifs")).toBeInTheDocument();
    expect(screen.getByLabelText("Profil")).toBeInTheDocument();
  });

  it("should navigate on tab click", async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<BottomTabBar />);

    await user.click(screen.getByLabelText("Recettes"));
    expect(mockedNavigate).toHaveBeenCalledWith("/recipes");

    await user.click(screen.getByLabelText("Profil"));
    expect(mockedNavigate).toHaveBeenCalledWith("/profile");
  });

  it("should highlight active tab", () => {
    window.history.pushState({}, "", "/recipes");
    renderWithUserAuth(<BottomTabBar />);

    const recipesTab = screen.getByLabelText("Recettes");
    expect(recipesTab).toHaveAttribute("aria-current", "page");

    const homeTab = screen.getByLabelText("Accueil");
    expect(homeTab).not.toHaveAttribute("aria-current");
  });

  it("should show unread badge on notifications tab", () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      count: 5,
      byCategory: {},
      loading: false,
      refresh: vi.fn(),
    });
    renderWithUserAuth(<BottomTabBar />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should show 99+ for large unread counts", () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      count: 150,
      byCategory: {},
      loading: false,
      refresh: vi.fn(),
    });
    renderWithUserAuth(<BottomTabBar />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("should not show badge when unread count is 0", () => {
    renderWithUserAuth(<BottomTabBar />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should hide when keyboard is visible", () => {
    vi.mocked(useKeyboardVisible).mockReturnValue(true);
    const { container } = renderWithUserAuth(<BottomTabBar />);

    expect(container.querySelector("nav")).toBeNull();
  });

  it("should match recipe sub-routes as active", () => {
    window.history.pushState({}, "", "/recipes/some-id");
    renderWithUserAuth(<BottomTabBar />);

    const recipesTab = screen.getByLabelText("Recettes");
    expect(recipesTab).toHaveAttribute("aria-current", "page");
  });
});
