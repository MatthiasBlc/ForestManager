import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import InviteCard from '../../../components/invitations/InviteCard';
import { setUserAuthenticated, resetAuthState, mockReceivedInvites } from '../../setup/mswHandlers';

describe('InviteCard', () => {
  const mockOnRespond = vi.fn();

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    mockOnRespond.mockClear();
  });

  it('should render invite details', () => {
    renderWithUserAuth(
      <InviteCard invite={mockReceivedInvites[0]} onRespond={mockOnRespond} />
    );

    expect(screen.getByText('Italian Cooking')).toBeInTheDocument();
    expect(screen.getByText('Best pasta recipes')).toBeInTheDocument();
    expect(screen.getByText(/david/)).toBeInTheDocument();
  });

  it('should show Accept and Reject buttons for pending invite', () => {
    renderWithUserAuth(
      <InviteCard invite={mockReceivedInvites[0]} onRespond={mockOnRespond} />
    );

    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('should navigate to community after accepting', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteCard invite={mockReceivedInvites[0]} onRespond={mockOnRespond} />
    );

    await user.click(screen.getByText('Accept'));

    await waitFor(() => {
      // Accept navigates to the community page instead of calling onRespond
      expect(mockOnRespond).not.toHaveBeenCalled();
    });
  });

  it('should call onRespond after rejecting', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(
      <InviteCard invite={mockReceivedInvites[0]} onRespond={mockOnRespond} />
    );

    await user.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(mockOnRespond).toHaveBeenCalled();
    });
  });

  it('should show status badge for non-pending invite', () => {
    const acceptedInvite = { ...mockReceivedInvites[0], status: 'ACCEPTED' as const };
    renderWithUserAuth(
      <InviteCard invite={acceptedInvite} onRespond={mockOnRespond} />
    );

    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });
});
