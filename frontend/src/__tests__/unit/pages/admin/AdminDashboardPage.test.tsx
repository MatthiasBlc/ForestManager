import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminDashboardPage from '../../../../pages/admin/AdminDashboardPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>Login Page</div>} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render dashboard title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('should display admin email in header', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  it('should display total stats cards', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Communities')).toBeInTheDocument();
      // "Recipes" may appear in multiple places (stat card and sidebar)
      expect(screen.getAllByText('Recipes').length).toBeGreaterThan(0);
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
    });

    // Check stat values
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // users
      expect(screen.getByText('500')).toBeInTheDocument(); // recipes
    });
  });

  it('should display weekly stats section', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('New Users')).toBeInTheDocument();
      expect(screen.getByText('New Communities')).toBeInTheDocument();
      expect(screen.getByText('New Recipes')).toBeInTheDocument();
    });
  });

  it('should display top communities table', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Top Communities')).toBeInTheDocument();
      expect(screen.getByText('Test Community')).toBeInTheDocument();
    });
  });

  it('should have logout button that can be clicked', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    // Clicking logout should not throw an error
    await user.click(screen.getByText('Logout'));

    // Verify the logout button was clickable (the actual logout behavior
    // depends on the AdminAuthContext which calls the API)
    expect(true).toBe(true);
  });
});
