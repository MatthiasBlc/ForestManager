import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminActivityPage from '../../../../pages/admin/AdminActivityPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/activity']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminActivityPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render activity page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });
  });

  it('should display activity list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('TAG_CREATED')).toBeInTheDocument();
      expect(screen.getByText('testadmin')).toBeInTheDocument();
    });
  });

  it('should have type filter dropdown', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('All types')).toBeInTheDocument();
    });
  });

  it('should filter by type', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('TAG_CREATED')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'ADMIN_LOGIN');

    // After filtering, the TAG_CREATED row should be gone
    await waitFor(() => {
      expect(screen.getByText('No activity found')).toBeInTheDocument();
    });
  });

  it('should display metadata details', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('name: dessert')).toBeInTheDocument();
    });
  });
});
