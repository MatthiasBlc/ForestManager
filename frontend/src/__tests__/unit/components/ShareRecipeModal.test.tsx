import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../setup/testUtils';
import userEvent from '@testing-library/user-event';
import { ShareRecipeModal } from '../../../components/share';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

describe('ShareRecipeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnShared = vi.fn();
  const defaultProps = {
    recipeId: 'test-recipe-id',
    recipeTitle: 'Test Recipe',
    currentCommunityId: 'community-1',
    onClose: mockOnClose,
    onShared: mockOnShared,
  };

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    vi.clearAllMocks();
  });

  it('renders modal with recipe title', async () => {
    render(<ShareRecipeModal {...defaultProps} />);

    expect(screen.getByText('Share Recipe')).toBeInTheDocument();
    expect(screen.getByText(/Share "Test Recipe" to another community/)).toBeInTheDocument();
  });

  it('loads communities and filters out current community', async () => {
    render(<ShareRecipeModal {...defaultProps} />);

    // Wait for communities to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Should show Vegan Recipes but not Baking Club (current community)
    expect(screen.getByText(/Vegan Recipes/)).toBeInTheDocument();
    expect(screen.queryByText(/Baking Club/)).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ShareRecipeModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking backdrop', async () => {
    const user = userEvent.setup();
    render(<ShareRecipeModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Click the backdrop
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      await user.click(backdrop);
    }
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables share button when no community is selected', async () => {
    render(<ShareRecipeModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Share button should be disabled when no community is selected
    const shareButton = screen.getByRole('button', { name: /Share to community/i });
    expect(shareButton).toBeDisabled();
  });

  it('shares recipe when community is selected', async () => {
    const user = userEvent.setup();
    render(<ShareRecipeModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Select a community
    await user.selectOptions(screen.getByRole('combobox'), 'community-2');

    // Click share
    const shareButton = screen.getByRole('button', { name: /Share to Vegan Recipes/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(mockOnShared).toHaveBeenCalled();
    });
  });

  it('disables buttons while sharing', async () => {
    const user = userEvent.setup();
    render(<ShareRecipeModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Select a community
    await user.selectOptions(screen.getByRole('combobox'), 'community-2');

    // Click share
    const shareButton = screen.getByRole('button', { name: /Share to Vegan Recipes/i });
    await user.click(shareButton);

    // Buttons should be disabled while sharing
    await waitFor(() => {
      expect(screen.getByText(/Sharing.../)).toBeInTheDocument();
    });
  });
});
