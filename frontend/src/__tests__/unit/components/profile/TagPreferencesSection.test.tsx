import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../../contexts/AuthContext';
import TagPreferencesSection from '../../../../components/profile/TagPreferencesSection';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { http, HttpResponse } from 'msw';
import { server } from '../../../setup/mswServer';

function TestApp() {
  return (
    <MemoryRouter>
      <AuthProvider>
        <TagPreferencesSection />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('TagPreferencesSection', () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should display communities with toggles', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Baking Club')).toBeInTheDocument();
      expect(screen.getByText('Vegan Recipes')).toBeInTheDocument();
    });

    expect(screen.getByText('Tag Visibility')).toBeInTheDocument();

    const bakingToggle = screen.getByLabelText('Show tags from Baking Club');
    const veganToggle = screen.getByLabelText('Show tags from Vegan Recipes');

    expect(bakingToggle).toBeChecked();
    expect(veganToggle).not.toBeChecked();
  });

  it('should toggle a preference value', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Vegan Recipes')).toBeInTheDocument();
    });

    const veganToggle = screen.getByLabelText('Show tags from Vegan Recipes');
    expect(veganToggle).not.toBeChecked();

    await user.click(veganToggle);

    // Optimistic update should change it immediately
    expect(veganToggle).toBeChecked();
  });

  it('should hide section when no communities', async () => {
    server.use(
      http.get('http://localhost:3001/api/users/me/tag-preferences', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Tag Visibility')).not.toBeInTheDocument();
  });

  it('should hide section on error', async () => {
    server.use(
      http.get('http://localhost:3001/api/users/me/tag-preferences', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }),
    );

    const { container } = render(<TestApp />);

    await waitFor(() => {
      expect(container.querySelector('.loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Tag Visibility')).not.toBeInTheDocument();
  });

  it('should revert toggle on API error', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Baking Club')).toBeInTheDocument();
    });

    // Override PUT to fail
    server.use(
      http.put('http://localhost:3001/api/users/me/tag-preferences/:communityId', () => {
        return HttpResponse.json({ error: 'Failed' }, { status: 500 });
      }),
    );

    const bakingToggle = screen.getByLabelText('Show tags from Baking Club');
    expect(bakingToggle).toBeChecked();

    await user.click(bakingToggle);

    // Should revert back to checked after API error
    await waitFor(() => {
      expect(bakingToggle).toBeChecked();
    });
  });
});
