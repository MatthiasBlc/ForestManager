import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminCommunitiesPage from '../../../../pages/admin/AdminCommunitiesPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/communities']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/communities" element={<AdminCommunitiesPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminCommunitiesPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render communities page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Communities')).toBeInTheDocument();
    });
  });

  it('should display communities list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Test Community')).toBeInTheDocument();
    });
  });

  it('should display member and recipe counts', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();  // members
      expect(screen.getByText('10')).toBeInTheDocument(); // recipes
    });
  });

  it('should display feature badges', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('MVP')).toBeInTheDocument();
    });
  });

  it('should have search input', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search communities...')).toBeInTheDocument();
    });
  });

  it('should have show deleted toggle', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Show deleted')).toBeInTheDocument();
    });
  });

  it('should open detail modal when clicking a community', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Test Community')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Community'));

    await waitFor(() => {
      // Detail modal should show member info
      expect(screen.getByText('user1')).toBeInTheDocument();
    });
  });

  it('should show delete button and handle deletion', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Test Community')).toBeInTheDocument();
    });

    // Find the Delete button in the table row
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);

    // Confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Delete community/)).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Community deleted')).toBeInTheDocument();
    });
  });
});
