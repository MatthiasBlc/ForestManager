import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithUserAuth } from "../../setup/testUtils";
import MembersList from "../../../components/communities/MembersList";
import { setUserAuthenticated, resetAuthState, mockMembers } from "../../setup/mswHandlers";

// Mock useIsMobile
const mockUseIsMobile = vi.fn();
vi.mock("../../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe("MembersList mobile layout", () => {
  const mockOnMembersChange = vi.fn();
  const mockOnLeave = vi.fn();

  const defaultProps = {
    communityId: "community-1",
    members: mockMembers,
    currentUserRole: "MODERATOR" as const,
    onMembersChange: mockOnMembersChange,
    onLeave: mockOnLeave,
  };

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    mockOnMembersChange.mockClear();
    mockOnLeave.mockClear();
  });

  it("should render cards instead of table on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    renderWithUserAuth(<MembersList {...defaultProps} />);

    // Cards use bg-base-200 rounded-lg, no table element
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // All members should still be visible
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("should render table on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    renderWithUserAuth(<MembersList {...defaultProps} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("should show role badges in card layout on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    renderWithUserAuth(<MembersList {...defaultProps} />);

    const moderatorBadges = screen.getAllByText("MODERATOR");
    expect(moderatorBadges.length).toBeGreaterThanOrEqual(1);
    const memberBadges = screen.getAllByText("MEMBER");
    expect(memberBadges.length).toBe(2);
  });

  it("should show action buttons in card layout on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    renderWithUserAuth(<MembersList {...defaultProps} />);

    expect(screen.getAllByText("Promote").length).toBe(2);
    expect(screen.getAllByText("Kick").length).toBe(2);
  });
});
