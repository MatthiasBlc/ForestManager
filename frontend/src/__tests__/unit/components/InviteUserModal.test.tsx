import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import InviteUserModal from '../../../components/invitations/InviteUserModal';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

describe('InviteUserModal', () => {
  const mockOnClose = vi.fn();
  const mockOnInviteSent = vi.fn();

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    mockOnClose.mockClear();
    mockOnInviteSent.mockClear();
  });

  it('should render modal with form', () => {
    renderWithUserAuth(
      <InviteUserModal communityId="community-1" onClose={mockOnClose} onInviteSent={mockOnInviteSent} />
    );

    expect(screen.getByText('Invite a user')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter username or email')).toBeInTheDocument();
    expect(screen.getByText('Send invitation')).toBeInTheDocument();
  });

  it('should show validation error when submitting empty', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteUserModal communityId="community-1" onClose={mockOnClose} onInviteSent={mockOnInviteSent} />
    );

    await user.click(screen.getByText('Send invitation'));

    await waitFor(() => {
      expect(screen.getByText('Username or email is required')).toBeInTheDocument();
    });
  });

  it('should call onInviteSent after successful invite', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteUserModal communityId="community-1" onClose={mockOnClose} onInviteSent={mockOnInviteSent} />
    );

    await user.type(screen.getByPlaceholderText('Enter username or email'), 'newuser');
    await user.click(screen.getByText('Send invitation'));

    await waitFor(() => {
      expect(mockOnInviteSent).toHaveBeenCalled();
    });
  });

  it('should show error when user not found', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteUserModal communityId="community-1" onClose={mockOnClose} onInviteSent={mockOnInviteSent} />
    );

    await user.type(screen.getByPlaceholderText('Enter username or email'), 'notfound');
    await user.click(screen.getByText('Send invitation'));

    await waitFor(() => {
      expect(screen.getByText(/not found|failed/i)).toBeInTheDocument();
    });
  });

  it('should call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteUserModal communityId="community-1" onClose={mockOnClose} onInviteSent={mockOnInviteSent} />
    );

    await user.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
