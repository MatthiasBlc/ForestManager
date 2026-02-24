import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import TagSuggestionsList from '../../../../components/recipes/TagSuggestionsList';
import { setUserAuthenticated } from '../../../setup/mswHandlers';

describe('TagSuggestionsList', () => {
  const defaultProps = {
    recipeId: 'test-recipe-id',
    onSuggestionDecided: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setUserAuthenticated(true);
  });

  it('should render suggestions list with pending suggestions', async () => {
    render(<TagSuggestionsList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Tag Suggestions (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText('gluten-free')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('should show accept and reject buttons for each suggestion', async () => {
    render(<TagSuggestionsList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Tag Suggestions (2)')).toBeInTheDocument();
    });

    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    expect(acceptButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  it('should call onSuggestionDecided when accepting', async () => {
    const user = userEvent.setup();
    render(<TagSuggestionsList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Tag Suggestions (2)')).toBeInTheDocument();
    });

    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    await user.click(acceptButtons[0]);

    await waitFor(() => {
      expect(defaultProps.onSuggestionDecided).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onSuggestionDecided when rejecting', async () => {
    const user = userEvent.setup();
    render(<TagSuggestionsList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Tag Suggestions (2)')).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(defaultProps.onSuggestionDecided).toHaveBeenCalledTimes(1);
    });
  });

  it('should render nothing when no suggestions', async () => {
    const { server } = await import('../../../setup/mswServer');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('http://localhost:3001/api/recipes/:recipeId/tag-suggestions', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        });
      })
    );

    render(
      <TagSuggestionsList recipeId="empty-recipe" onSuggestionDecided={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Tag Suggestions/)).not.toBeInTheDocument();
    });
  });
});
