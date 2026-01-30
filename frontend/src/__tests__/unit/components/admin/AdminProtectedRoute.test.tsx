import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminProtectedRoute from '../../../../components/admin/AdminProtectedRoute';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

function TestApp({ initialPath = '/admin/protected' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>Login Page</div>} />
          <Route
            path="/admin/protected"
            element={
              <AdminProtectedRoute>
                <div>Protected Content</div>
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminProtectedRoute', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should show loading spinner while checking auth', () => {
    render(<TestApp />);

    // Loading spinner should be visible initially (DaisyUI loading class)
    expect(document.querySelector('.loading')).toBeTruthy();
  });

  it('should redirect to login when not authenticated', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('should render children when authenticated', async () => {
    setAdminAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should not show protected content when not authenticated', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});
