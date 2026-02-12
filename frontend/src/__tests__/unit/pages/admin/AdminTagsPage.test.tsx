import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminTagsPage from '../../../../pages/admin/AdminTagsPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/tags']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/tags" element={<AdminTagsPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminTagsPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render tags page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });
  });

  it('should display tags list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('dessert')).toBeInTheDocument();
      expect(screen.getByText('dinner')).toBeInTheDocument();
      expect(screen.getByText('breakfast')).toBeInTheDocument();
    });
  });

  it('should display recipe counts', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should open create modal when Add Tag is clicked', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Tag')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Tag'));

    expect(screen.getByText('Create Tag')).toBeInTheDocument();
  });

  it('should create a new tag', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Tag')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Tag'));
    const inputs = screen.getAllByRole('textbox');
    // Modal input is the last one (search is first)
    await user.type(inputs[inputs.length - 1], 'newtag');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Tag created')).toBeInTheDocument();
    });
  });

  it('should open edit modal when Edit is clicked', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('dessert')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Tag')).toBeInTheDocument();
  });

  it('should delete a tag after confirmation', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('dessert')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    // Confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Delete tag/)).toBeInTheDocument();
    });

    // The confirm dialog's confirm button uses confirmLabel="Delete"
    const confirmButtons = screen.getAllByText('Delete');
    // The last "Delete" button is the one in the confirm dialog
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Tag deleted')).toBeInTheDocument();
    });
  });

  it('should open merge modal when Merge is clicked', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('dessert')).toBeInTheDocument();
    });

    const mergeButtons = screen.getAllByText('Merge');
    await user.click(mergeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Merge "dessert" into/)).toBeInTheDocument();
    });
  });
});
