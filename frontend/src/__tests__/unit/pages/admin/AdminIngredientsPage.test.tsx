import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminIngredientsPage from '../../../../pages/admin/AdminIngredientsPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/ingredients']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/ingredients" element={<AdminIngredientsPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminIngredientsPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render ingredients page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
    });
  });

  it('should display ingredients list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
      expect(screen.getByText('flour')).toBeInTheDocument();
      expect(screen.getByText('butter')).toBeInTheDocument();
    });
  });

  it('should display recipe counts', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should open create modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Ingredient')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Ingredient'));

    expect(screen.getByText('Create Ingredient')).toBeInTheDocument();
  });

  it('should create a new ingredient', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Ingredient')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Ingredient'));
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[inputs.length - 1], 'salt');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Ingredient created')).toBeInTheDocument();
    });
  });

  it('should open edit modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Ingredient')).toBeInTheDocument();
  });

  it('should delete an ingredient after confirmation', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Delete ingredient/)).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Ingredient deleted')).toBeInTheDocument();
    });
  });

  it('should open merge modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    });

    const mergeButtons = screen.getAllByText('Merge');
    await user.click(mergeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Merge "sugar" into/)).toBeInTheDocument();
    });
  });
});
