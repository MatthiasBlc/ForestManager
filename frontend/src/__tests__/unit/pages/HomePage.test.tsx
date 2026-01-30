import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../contexts/AuthContext';
import HomePage from '../../../pages/HomePage';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes" element={<div>Recipes Page</div>} />
          <Route path="/signup" element={<div>Signup Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should render app title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Forest Manager')).toBeInTheDocument();
    });
  });

  it('should render tagline', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText(/Partagez vos recettes/)).toBeInTheDocument();
    });
  });

  it('should have link to signup page', async () => {
    render(<TestApp />);

    await waitFor(() => {
      const ctaButton = screen.getByText('Commencer');
      expect(ctaButton.closest('a')).toHaveAttribute('href', '/signup');
    });
  });

  it('should have link to privacy policy', async () => {
    render(<TestApp />);

    await waitFor(() => {
      const privacyLink = screen.getByText('Privacy Policy');
      expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
    });
  });

  it('should redirect to recipes page when authenticated', async () => {
    setUserAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Recipes Page')).toBeInTheDocument();
    });
  });

  it('should not show home content when authenticated', async () => {
    setUserAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.queryByText('Forest Manager')).not.toBeInTheDocument();
    });
  });
});
