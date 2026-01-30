import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import IngredientList, { IngredientInput } from '../../../../components/form/IngredientList';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

describe('IngredientList', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should render add ingredient button', () => {
    render(
      <IngredientList
        value={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Add ingredient')).toBeInTheDocument();
  });

  it('should add new ingredient when Add button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <IngredientList
        value={[]}
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByText('Add ingredient'));

    expect(mockOnChange).toHaveBeenCalledWith([{ name: '', quantity: '' }]);
  });

  it('should display existing ingredients', () => {
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: '100g' },
      { name: 'flour', quantity: '200g' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByDisplayValue('sugar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100g')).toBeInTheDocument();
    expect(screen.getByDisplayValue('flour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200g')).toBeInTheDocument();
  });

  it('should update ingredient name', async () => {
    const user = userEvent.setup();
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: '100g' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    const nameInput = screen.getByDisplayValue('sugar');
    await user.clear(nameInput);
    await user.type(nameInput, 'salt');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should update ingredient quantity', async () => {
    const user = userEvent.setup();
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: '100g' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    const quantityInput = screen.getByDisplayValue('100g');
    await user.clear(quantityInput);
    await user.type(quantityInput, '200g');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should remove ingredient when remove button is clicked', async () => {
    const user = userEvent.setup();
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: '100g' },
      { name: 'flour', quantity: '200g' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    // Find remove buttons (buttons with FaTimes icon)
    const removeButtons = screen.getAllByRole('button').filter(btn =>
      btn.classList.contains('text-error')
    );

    await user.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      { name: 'flour', quantity: '200g' },
    ]);
  });

  it('should render placeholder text for empty inputs', () => {
    const ingredients: IngredientInput[] = [
      { name: '', quantity: '' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByPlaceholderText('Ingredient name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Quantity (optional)')).toBeInTheDocument();
  });
});
