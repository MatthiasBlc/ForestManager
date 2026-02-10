import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import MembersList from '../../../components/communities/MembersList';
import { setUserAuthenticated, resetAuthState, mockMembers } from '../../setup/mswHandlers';

describe('MembersList', () => {
  const mockOnMembersChange = vi.fn();
  const mockOnLeave = vi.fn();

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    mockOnMembersChange.mockClear();
    mockOnLeave.mockClear();
  });

  const defaultProps = {
    communityId: 'community-1',
    members: mockMembers,
    currentUserRole: 'MODERATOR' as const,
    onMembersChange: mockOnMembersChange,
    onLeave: mockOnLeave,
  };

  it('should render all members', () => {
    renderWithUserAuth(<MembersList {...defaultProps} />);

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('should show role badges', () => {
    renderWithUserAuth(<MembersList {...defaultProps} />);

    const moderatorBadges = screen.getAllByText('MODERATOR');
    expect(moderatorBadges.length).toBeGreaterThanOrEqual(1);
    const memberBadges = screen.getAllByText('MEMBER');
    expect(memberBadges.length).toBe(2);
  });

  it('should show Promote and Kick buttons for regular members when moderator', () => {
    renderWithUserAuth(<MembersList {...defaultProps} />);

    const promoteButtons = screen.getAllByText('Promote');
    expect(promoteButtons.length).toBe(2);

    const kickButtons = screen.getAllByText('Kick');
    expect(kickButtons.length).toBe(2);
  });

  it('should not show Promote/Kick for members when current user is MEMBER', () => {
    renderWithUserAuth(
      <MembersList {...defaultProps} currentUserRole="MEMBER" />
    );

    expect(screen.queryByText('Promote')).not.toBeInTheDocument();
    expect(screen.queryByText('Kick')).not.toBeInTheDocument();
  });

  it('should show Leave button for current user', async () => {
    renderWithUserAuth(<MembersList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Leave')).toBeInTheDocument();
    });
  });

  it('should call onMembersChange after promoting a member', async () => {
    const user = userEvent.setup();

    renderWithUserAuth(<MembersList {...defaultProps} />);

    const promoteButtons = screen.getAllByText('Promote');
    await user.click(promoteButtons[0]);

    // Confirm in the custom confirm dialog
    const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnMembersChange).toHaveBeenCalled();
    });
  });
});
