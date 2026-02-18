import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../../contexts/AuthContext';
import CommunityTagsList from '../../../../components/communities/CommunityTagsList';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { Toaster } from 'react-hot-toast';

function TestApp() {
  return (
    <MemoryRouter>
      <AuthProvider>
        <CommunityTagsList communityId="community-1" />
        <Toaster />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('CommunityTagsList', () => {
  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should display APPROVED and PENDING tags with correct styles', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('appetizer')).toBeInTheDocument();
      expect(screen.getByText('spicy')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
    });

    // Pending tag should show "(pending)" text
    expect(screen.getByText('(pending)')).toBeInTheDocument();
  });

  it('should filter by status when clicking filter buttons', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('appetizer')).toBeInTheDocument();
    });

    // Click "Pending" filter
    await user.click(screen.getByText('Pending'));

    await waitFor(() => {
      expect(screen.getByText('spicy')).toBeInTheDocument();
    });

    // Click "Approved" filter
    await user.click(screen.getByText('Approved'));

    await waitFor(() => {
      expect(screen.getByText('appetizer')).toBeInTheDocument();
    });
  });

  it('should open create modal and create a tag', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Add Tag')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Tag'));

    expect(screen.getByText('Create Tag')).toBeInTheDocument();

    // Type in the modal input
    const inputs = screen.getAllByRole('textbox');
    const modalInput = inputs[inputs.length - 1];
    await user.type(modalInput, 'newtag');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Tag created')).toBeInTheDocument();
    });
  });

  it('should open edit modal and save', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('appetizer')).toBeInTheDocument();
    });

    // Click edit on the first APPROVED tag
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Tag')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    const modalInput = inputs[inputs.length - 1];
    await user.clear(modalInput);
    await user.type(modalInput, 'updated');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Tag updated')).toBeInTheDocument();
    });
  });

  it('should delete a tag after confirmation', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('appetizer')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Delete tag/)).toBeInTheDocument();
    });

    // Click confirm Delete button in dialog
    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Tag deleted')).toBeInTheDocument();
    });
  });

  it('should approve a pending tag', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('spicy')).toBeInTheDocument();
    });

    const approveButton = screen.getByTitle('Approve');
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText('Tag approved')).toBeInTheDocument();
    });
  });

  it('should reject a pending tag after confirmation', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('spicy')).toBeInTheDocument();
    });

    const rejectButton = screen.getByTitle('Reject');
    await user.click(rejectButton);

    // Confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Reject tag/)).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByText('Reject');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Tag rejected')).toBeInTheDocument();
    });
  });

  it('should display creator info for pending tags', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('by alice')).toBeInTheDocument();
    });
  });
});
