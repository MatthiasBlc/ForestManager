import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminAuthProvider } from '../../../../contexts/AdminAuthContext';
import AdminUnitsPage from '../../../../pages/admin/AdminUnitsPage';
import { setAdminAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/admin/units']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/units" element={<AdminUnitsPage />} />
        </Routes>
        <Toaster />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminUnitsPage', () => {
  beforeEach(() => {
    resetAuthState();
    setAdminAuthenticated(true);
  });

  it('should render units page title', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Units')).toBeInTheDocument();
    });
  });

  it('should display units list', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
      expect(screen.getByText('kilogramme')).toBeInTheDocument();
      expect(screen.getByText('centilitre')).toBeInTheDocument();
    });
  });

  it('should display abbreviations', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
    });

    // Abbreviations in the table
    const cells = screen.getAllByRole('cell');
    const abbreviations = cells.map(c => c.textContent);
    expect(abbreviations).toContain('g');
    expect(abbreviations).toContain('kg');
    expect(abbreviations).toContain('cl');
  });

  it('should display category badges', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Weight').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Volume').length).toBeGreaterThanOrEqual(1);
  });

  it('should display usage counts', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should open create modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Unit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Unit'));

    expect(screen.getByText('Create Unit')).toBeInTheDocument();
  });

  it('should create a new unit', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Unit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Unit'));

    const nameInput = screen.getByPlaceholderText('gramme');
    const abbrInput = screen.getByPlaceholderText('g');

    await user.type(nameInput, 'litre');
    await user.type(abbrInput, 'L');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Unit created')).toBeInTheDocument();
    });
  });

  it('should open edit modal', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Unit')).toBeInTheDocument();
  });

  it('should delete a unit after confirmation', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Delete unit/)).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Unit deleted')).toBeInTheDocument();
    });
  });

  it('should filter by category', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('gramme')).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(categorySelect, 'VOLUME');

    await waitFor(() => {
      expect(screen.getByText('centilitre')).toBeInTheDocument();
    });
  });
});
