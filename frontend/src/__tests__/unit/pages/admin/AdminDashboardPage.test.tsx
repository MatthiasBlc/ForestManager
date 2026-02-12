import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

  it('should display total stats cards', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Communities')).toBeInTheDocument();
      expect(screen.getAllByText('Recipes').length).toBeGreaterThan(0);
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
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
});
