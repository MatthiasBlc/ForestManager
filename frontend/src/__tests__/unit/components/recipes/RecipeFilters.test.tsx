import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import RecipeFilters from '../../../../components/recipes/RecipeFilters';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

describe('RecipeFilters', () => {
  const mockOnSearchChange = vi.fn();
  const mockOnTagsChange = vi.fn();
  const mockOnIngredientsChange = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    setUserAuthenticated(true);
  });

  const defaultProps = {
    search: '',
    tags: [],
    ingredients: [],
    onSearchChange: mockOnSearchChange,
    onTagsChange: mockOnTagsChange,
    onIngredientsChange: mockOnIngredientsChange,
    onReset: mockOnReset,
  };

  it('should render search input', () => {
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search by title...')).toBeInTheDocument();
  });

  it('should render tag selector', () => {
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.getByText('Filter by tags')).toBeInTheDocument();
  });

  it('should render ingredient selector', () => {
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.getByText('Filter by ingredients')).toBeInTheDocument();
  });

  it('should call onSearchChange with debounce', async () => {
    const user = userEvent.setup();

    render(<RecipeFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by title...');
    await user.type(searchInput, 'test');

    // After debounce (300ms), onSearchChange should be called
    await waitFor(() => {
      expect(mockOnSearchChange).toHaveBeenCalledWith('test');
    }, { timeout: 1000 });
  });

  it('should show clear button when filters are active', () => {
    render(
      <RecipeFilters
        {...defaultProps}
        search="test"
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('should not show clear button when no filters are active', () => {
    render(<RecipeFilters {...defaultProps} />);

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('should call onReset when clear filters is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecipeFilters
        {...defaultProps}
        search="test"
      />
    );

    await user.click(screen.getByText('Clear filters'));

    expect(mockOnReset).toHaveBeenCalled();
  });

  it('should show clear button when tags are active', () => {
    render(
      <RecipeFilters
        {...defaultProps}
        tags={['dessert']}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('should show clear button when ingredients are active', () => {
    render(
      <RecipeFilters
        {...defaultProps}
        ingredients={['sugar']}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });
});
