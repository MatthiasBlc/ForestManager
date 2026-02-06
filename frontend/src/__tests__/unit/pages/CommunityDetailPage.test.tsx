import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';
import CommunityDetailPage from '../../../pages/CommunityDetailPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import { render } from '@testing-library/react';

function renderWithRoute(communityId: string) {
  return render(
    <MemoryRouter initialEntries={[`/communities/${communityId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/communities/:id" element={<CommunityDetailPage />} />
          <Route path="/communities" element={<div>Communities List</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('CommunityDetailPage', () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should show loading spinner initially', () => {
    renderWithRoute('community-1');
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
  });

  it('should display community name and description', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByText('Baking Club')).toBeInTheDocument();
      expect(screen.getByText('A community for baking enthusiasts')).toBeInTheDocument();
    });
  });

  it('should display role badge', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      const moderatorElements = screen.getAllByText('MODERATOR');
      expect(moderatorElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show recipes by default', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByText('Recipes')).toBeInTheDocument();
    });
  });

  it('should show Members icon button', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Members')).toBeInTheDocument();
    });
  });

  it('should open Members panel when Members icon is clicked', async () => {
    const user = userEvent.setup();
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Members')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Members'));

    await waitFor(() => {
      // Panel header should show "Members"
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('should show Activity icon for moderator', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Activity')).toBeInTheDocument();
    });
  });

  it('should show Invitations icon for moderator', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Invitations')).toBeInTheDocument();
    });
  });

  it('should open Invitations panel when clicked', async () => {
    const user = userEvent.setup();
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Invitations')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Invitations'));

    await waitFor(() => {
      expect(screen.getByText('Invite user')).toBeInTheDocument();
    });
  });

  it('should show Edit button for moderator', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Edit')).toBeInTheDocument();
    });
  });

  it('should show error for non-existent community', async () => {
    renderWithRoute('not-found');

    await waitFor(() => {
      const errorAlert = document.querySelector('.alert-error');
      expect(errorAlert).toBeInTheDocument();
    });
  });
});
