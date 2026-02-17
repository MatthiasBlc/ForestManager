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

  it('should display global toggle and community toggles for moderator', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Tag Notifications')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Global tag notifications')).toBeChecked();
    expect(screen.getByText('Baking Club')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag notifications for Baking Club')).toBeChecked();
  });

  it('should toggle global notification preference', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Tag Notifications')).toBeInTheDocument();
    });

    const globalToggle = screen.getByLabelText('Global tag notifications');
    expect(globalToggle).toBeChecked();

    await user.click(globalToggle);

    expect(globalToggle).not.toBeChecked();
  });

  it('should toggle community notification preference', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Baking Club')).toBeInTheDocument();
    });

    const communityToggle = screen.getByLabelText('Tag notifications for Baking Club');
    expect(communityToggle).toBeChecked();

    await user.click(communityToggle);

    expect(communityToggle).not.toBeChecked();
  });

  it('should hide section when not a moderator (empty communities)', async () => {
    server.use(
      http.get('http://localhost:3001/api/users/me/notification-preferences', () => {
        return HttpResponse.json({
          global: { tagNotifications: false },
          communities: [],
        });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Tag Notifications')).not.toBeInTheDocument();
  });

  it('should hide section on 403 error (non-moderator)', async () => {
    server.use(
      http.get('http://localhost:3001/api/users/me/notification-preferences', () => {
        return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Tag Notifications')).not.toBeInTheDocument();
  });
});
