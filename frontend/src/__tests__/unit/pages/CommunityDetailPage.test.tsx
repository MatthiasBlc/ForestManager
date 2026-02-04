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
      // Multiple MODERATOR texts exist (header badge + member table)
      const moderatorElements = screen.getAllByText('MODERATOR');
      expect(moderatorElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show Members tab by default', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('should show Invitations tab for moderator', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /invitations/i })).toBeInTheDocument();
    });
  });

  it('should switch to Invitations tab when clicked', async () => {
    const user = userEvent.setup();
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /invitations/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: /invitations/i }));

    await waitFor(() => {
      expect(screen.getByText('Invite user')).toBeInTheDocument();
    });
  });

  it('should show Edit button for moderator', async () => {
    renderWithRoute('community-1');

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  it('should show error for non-existent community', async () => {
    renderWithRoute('not-found');

    await waitFor(() => {
      // handleApiError throws "Request failed with status: 404 message Community not found"
      const errorAlert = document.querySelector('.alert-error');
      expect(errorAlert).toBeInTheDocument();
    });
  });
});
