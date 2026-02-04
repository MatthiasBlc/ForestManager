import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import CommunitiesPage from '../../../pages/CommunitiesPage';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

describe('CommunitiesPage', () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should show loading spinner initially', () => {
    renderWithUserAuth(<CommunitiesPage />);
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
  });

  it('should display communities list after loading', async () => {
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Baking Club')).toBeInTheDocument();
      expect(screen.getByText('Vegan Recipes')).toBeInTheDocument();
    });
  });

  it('should display page title', async () => {
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('My Communities')).toBeInTheDocument();
    });
  });

  it('should show create button', async () => {
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('New Community')).toBeInTheDocument();
    });
  });

  it('should show member and recipe counts', async () => {
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('5 members')).toBeInTheDocument();
      expect(screen.getByText('10 recipes')).toBeInTheDocument();
    });
  });

  it('should show role badges', async () => {
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('MODERATOR')).toBeInTheDocument();
      expect(screen.getByText('MEMBER')).toBeInTheDocument();
    });
  });

  it('should navigate to create page when clicking create button', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<CommunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('New Community')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Community'));
    expect(window.location.pathname).toBe('/communities/create');
  });
});
