import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminLoginPage from '../../../../pages/admin/AdminLoginPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/login']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should render credentials form initially', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('********')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('should redirect to dashboard if already authenticated', async () => {
    setAdminAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });

  it('should show TOTP form after valid credentials', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('admin@example.com'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('********'), 'AdminTest123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    });
  });

  it('should show QR code for new admin requiring TOTP setup', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('admin@example.com'), 'newadmin@example.com');
    await user.type(screen.getByPlaceholderText('********'), 'AdminTest123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByAltText('TOTP QR Code')).toBeInTheDocument();
      expect(screen.getByText(/First time setup/)).toBeInTheDocument();
    });
  });

  it('should show error on invalid credentials', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('admin@example.com'), 'wrong@example.com');
    await user.type(screen.getByPlaceholderText('********'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      // Error is displayed in an alert div with class "alert-error"
      expect(document.querySelector('.alert-error')).toBeInTheDocument();
    });
  });

  it('should complete login flow and redirect to dashboard', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });

    // Step 1: Credentials
    await user.type(screen.getByPlaceholderText('admin@example.com'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('********'), 'AdminTest123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: TOTP
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });

  it('should allow going back to credentials from TOTP step', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('admin@example.com'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('********'), 'AdminTest123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Back to login')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to login'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    });
  });

  it('should show unauthorized access warning', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText(/Unauthorized access is prohibited/)).toBeInTheDocument();
    });
  });
});
