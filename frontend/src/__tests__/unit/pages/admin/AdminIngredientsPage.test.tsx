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

  it('should display ingredients list with enriched data', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
      expect(screen.getByText('flour')).toBeInTheDocument();
      expect(screen.getByText('butter')).toBeInTheDocument();
    });
  });

  it('should display status badges', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    });

    const approvedBadges = screen.getAllByText('Approved');
    const pendingBadges = screen.getAllByText('Pending');
    expect(approvedBadges.length).toBeGreaterThanOrEqual(1);
    expect(pendingBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should display default unit abbreviation', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('g')).toBeInTheDocument();
    });
  });

  it('should display createdBy info', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
  });

  it('should display recipe counts', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should filter by status', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Status filter');
    await user.selectOptions(statusSelect, 'PENDING');

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
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

  it('should show approve/reject buttons for PENDING ingredients', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Approve').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reject').length).toBeGreaterThanOrEqual(1);
  });

  it('should approve a pending ingredient', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/approved/)).toBeInTheDocument();
    });
  });

  it('should open approve with rename modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
    });

    const renameButtons = screen.getAllByText('Rename');
    await user.click(renameButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Approve & Rename')).toBeInTheDocument();
    });
  });

  it('should open reject modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Reject Ingredient')).toBeInTheDocument();
    });
  });

  it('should reject a pending ingredient with reason', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Reject Ingredient')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Explain why/);
    await user.type(textarea, 'Duplicate ingredient');

    const confirmReject = screen.getAllByText('Reject');
    await user.click(confirmReject[confirmReject.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/rejected/)).toBeInTheDocument();
    });
  });
});
