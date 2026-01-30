import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../contexts/AuthContext';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

function TestApp({ initialPath = '/protected' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/signup" element={<div>Signup Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should show loading spinner while checking auth', () => {
    render(<TestApp />);

    // Loading spinner should be visible initially
    expect(document.querySelector('.loading')).toBeTruthy();
  });

  it('should redirect to signup when not authenticated', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Signup Page')).toBeInTheDocument();
    });
  });

  it('should render children when authenticated', async () => {
    setUserAuthenticated(true);
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

  it('should keep showing protected content if user is already authenticated', async () => {
    setUserAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(screen.queryByText('Signup Page')).not.toBeInTheDocument();
    });
  });
});
