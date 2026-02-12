import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminFeaturesPage from '../../../../pages/admin/AdminFeaturesPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/features']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/features" element={<AdminFeaturesPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminFeaturesPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render features page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Features')).toBeInTheDocument();
    });
  });

  it('should display features list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('MVP')).toBeInTheDocument();
      expect(screen.getByText('MVP Feature')).toBeInTheDocument();
      expect(screen.getByText('PREMIUM')).toBeInTheDocument();
      expect(screen.getByText('Premium Feature')).toBeInTheDocument();
    });
  });

  it('should display isDefault badges', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument(); // MVP is default
      expect(screen.getByText('No')).toBeInTheDocument();  // PREMIUM is not
    });
  });

  it('should open create modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Feature')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Feature'));

    expect(screen.getByText('Create Feature')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('FEATURE_CODE')).toBeInTheDocument();
  });

  it('should create a new feature', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Feature')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Feature'));

    const codeInput = screen.getByPlaceholderText('FEATURE_CODE');
    const nameInputs = screen.getAllByRole('textbox');
    // Code is first textbox, name is second
    await user.type(codeInput, 'ADVANCED');
    await user.type(nameInputs[1], 'Advanced Feature');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Feature created')).toBeInTheDocument();
    });
  });

  it('should open edit modal for existing feature', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('MVP Feature')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Feature')).toBeInTheDocument();
  });
});
