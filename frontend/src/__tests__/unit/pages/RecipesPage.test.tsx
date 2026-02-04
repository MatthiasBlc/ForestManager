import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithUserAuth } from '../../setup/testUtils';
import RecipesPage from '../../../pages/RecipesPage';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

describe('RecipesPage', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should show logged out view when not authenticated', async () => {
    renderWithUserAuth(<RecipesPage />);

    await waitFor(() => {
      // Logged out view shows this message
      expect(screen.getByText(/Please Login to see your recipes/i)).toBeInTheDocument();
    });
  });

  it('should show logged in view when authenticated', async () => {
    setUserAuthenticated(true);
    renderWithUserAuth(<RecipesPage />);

    await waitFor(() => {
      // Logged in view shows the recipe list/grid
      // Check that logged out message is NOT shown
      expect(screen.queryByText(/Please Login to see your recipes/i)).not.toBeInTheDocument();
    });
  });

  it('should render different content based on auth state', async () => {
    // First render logged out
    const { unmount } = renderWithUserAuth(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Please Login to see your recipes/i)).toBeInTheDocument();
    });

    unmount();
    resetAuthState();
    setUserAuthenticated(true);

    // Now render logged in
    renderWithUserAuth(<RecipesPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Please Login to see your recipes/i)).not.toBeInTheDocument();
    });
  });
});
