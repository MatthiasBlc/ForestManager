import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import ProposeModificationModal from '../../../../components/proposals/ProposeModificationModal';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { RecipeIngredient } from '../../../../models/recipe';

const mockIngredients: RecipeIngredient[] = [
  { id: 'ri-1', name: 'sugar', ingredientId: 'ing-1', quantity: 100, unitId: 'unit-1', unit: { id: 'unit-1', name: 'gramme', abbreviation: 'g' }, order: 0 },
  { id: 'ri-2', name: 'flour', ingredientId: 'ing-2', quantity: 200, unitId: null, unit: null, order: 1 },
];

describe('ProposeModificationModal', () => {
  const defaultProps = {
    recipeId: 'test-recipe-id',
    currentTitle: 'Original Title',
    currentSteps: [{ id: 'step-1', order: 0, instruction: 'Original content' }],
    currentServings: 4,
    currentPrepTime: 15 as number | null,
    currentCookTime: 30 as number | null,
    currentRestTime: null as number | null,
    currentIngredients: mockIngredients,
    onClose: vi.fn(),
    onProposalSubmitted: vi.fn(),
  };

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    vi.clearAllMocks();
  });

  it('should render modal with title, content and ingredients sections', () => {
    render(<ProposeModificationModal {...defaultProps} />);

    expect(screen.getByText('Propose a modification')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original content')).toBeInTheDocument();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
  });

  it('should pre-fill ingredients from current recipe', () => {
    render(<ProposeModificationModal {...defaultProps} />);

    expect(screen.getByDisplayValue('sugar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('flour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
  });

  it('should disable submit when no changes are made', () => {
    render(<ProposeModificationModal {...defaultProps} />);

    const submitButton = screen.getByText('Submit proposal');
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/You need to make changes/)).toBeInTheDocument();
  });

  it('should enable submit when title is changed', async () => {
    const user = userEvent.setup();
    render(<ProposeModificationModal {...defaultProps} />);

    const titleInput = screen.getByDisplayValue('Original Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'New Title');

    const submitButton = screen.getByText('Submit proposal');
    expect(submitButton).not.toBeDisabled();
  });

  it('should enable submit when content is changed', async () => {
    const user = userEvent.setup();
    render(<ProposeModificationModal {...defaultProps} />);

    const contentTextarea = screen.getByDisplayValue('Original content');
    await user.clear(contentTextarea);
    await user.type(contentTextarea, 'New content');

    const submitButton = screen.getByText('Submit proposal');
    expect(submitButton).not.toBeDisabled();
  });

  it('should submit proposal with ingredients', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    render(<ProposeModificationModal {...defaultProps} onProposalSubmitted={onSubmitted} />);

    const titleInput = screen.getByDisplayValue('Original Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Modified Title');

    await user.click(screen.getByText('Submit proposal'));

    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProposeModificationModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should show Add ingredient button', () => {
    render(<ProposeModificationModal {...defaultProps} />);

    expect(screen.getByText('Add ingredient')).toBeInTheDocument();
  });
});
