import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithUserAuth } from '../../setup/testUtils';
import NavBar from '../../../components/Navbar/NavBar';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

describe('NavBar', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should render app name/logo', async () => {
    renderWithUserAuth(<NavBar />);

    await waitFor(() => {
      expect(screen.getByText('Forest Manager')).toBeInTheDocument();
    });
  });

  it('should link logo to home page', async () => {
    renderWithUserAuth(<NavBar />);

    await waitFor(() => {
      const logo = screen.getByText('Forest Manager');
      expect(logo.closest('a')).toHaveAttribute('href', '/');
    });
  });

  it('should show logged out view when not authenticated', async () => {
    renderWithUserAuth(<NavBar />);

    await waitFor(() => {
      // Check for login button (typical for logged out view)
      expect(screen.getByText('Log In')).toBeInTheDocument();
    });
  });

  it('should show logged in view when authenticated', async () => {
    setUserAuthenticated(true);
    renderWithUserAuth(<NavBar />);

    await waitFor(() => {
      // Logged in view typically shows user info or logout button
      expect(screen.queryByText('Log In')).not.toBeInTheDocument();
    });
  });
});
