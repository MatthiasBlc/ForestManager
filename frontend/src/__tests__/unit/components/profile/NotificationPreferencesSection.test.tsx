import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../../contexts/AuthContext';
import NotificationPreferencesSection from '../../../../components/profile/NotificationPreferencesSection';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { http, HttpResponse } from 'msw';
import { server } from '../../../setup/mswServer';

function TestApp() {
  return (
    <MemoryRouter>
      <AuthProvider>
        <NotificationPreferencesSection />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('NotificationPreferencesSection', () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should display all 5 category toggles', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Preferences de notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('Invitations')).toBeInTheDocument();
    expect(screen.getByText('Propositions de recettes')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Moderation')).toBeInTheDocument();
  });

  it('should display global toggles with correct initial state', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Preferences de notifications')).toBeInTheDocument();
    });

    // All global toggles should be checked (default true from MSW handler)
    expect(screen.getByLabelText('Invitations (global)')).toBeChecked();
    expect(screen.getByLabelText('Tags (global)')).toBeChecked();
  });

  it('should toggle global notification preference', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Preferences de notifications')).toBeInTheDocument();
    });

    const globalToggle = screen.getByLabelText('Invitations (global)');
    expect(globalToggle).toBeChecked();

    await user.click(globalToggle);

    expect(globalToggle).not.toBeChecked();
  });

  it('should hide section on error', async () => {
    server.use(
      http.get('http://localhost:3001/api/notifications/preferences', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Preferences de notifications')).not.toBeInTheDocument();
  });

  it('should hide section on 401 error', async () => {
    server.use(
      http.get('http://localhost:3001/api/notifications/preferences', () => {
        return HttpResponse.json({ error: 'AUTH_001: Not authenticated' }, { status: 401 });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Preferences de notifications')).not.toBeInTheDocument();
  });
});
