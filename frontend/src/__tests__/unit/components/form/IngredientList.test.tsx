import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState as reactUseState } from 'react';
import { render } from '../../../setup/testUtils';
import IngredientList, { IngredientInput } from '../../../../components/form/IngredientList';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

// Wrapper avec vrai state pour tester les interactions autocomplete
const StatefulIngredientList = ({ initial = [{ name: '' }] }: { initial?: IngredientInput[] }) => {
  const [ingredients, setIngredients] = reactUseState<IngredientInput[]>(initial);
  return <IngredientList value={ingredients} onChange={setIngredients} />;
};

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

    expect(mockOnChange).toHaveBeenCalledWith([{ name: '' }]);
  });

  it('should display existing ingredients', () => {
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: 100 },
      { name: 'flour', quantity: 200 },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByDisplayValue('sugar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('flour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
  });

  it('should update ingredient name', async () => {
    const user = userEvent.setup();
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: 100 },
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

  it('should update ingredient quantity as a number', async () => {
    const user = userEvent.setup();
    // Start with no quantity so typing produces a clean number
    const ingredients: IngredientInput[] = [
      { name: 'sugar' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    const quantityInput = screen.getByPlaceholderText('Qty');
    await user.type(quantityInput, '250');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(typeof lastCall[0].quantity).toBe('number');
    });
  });

  it('should remove ingredient when remove button is clicked', async () => {
    const user = userEvent.setup();
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: 100 },
      { name: 'flour', quantity: 200 },
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
      { name: 'flour', quantity: 200 },
    ]);
  });

  it('should render placeholder text for empty inputs', () => {
    const ingredients: IngredientInput[] = [
      { name: '' },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByPlaceholderText('Ingredient name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Qty')).toBeInTheDocument();
  });

  it('should show PENDING badge for PENDING ingredients in autocomplete', async () => {
    const user = userEvent.setup();

    render(<StatefulIngredientList />);

    const nameInput = screen.getByPlaceholderText('Ingredient name');
    await user.type(nameInput, 'new');

    await waitFor(() => {
      // "new_pending" ingredient from MSW mock should show with badge "nouveau"
      expect(screen.getByText('nouveau')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should render UnitSelector dropdown for each ingredient row', async () => {
    const ingredients: IngredientInput[] = [
      { name: 'sugar', quantity: 100 },
    ];

    render(
      <IngredientList
        value={ingredients}
        onChange={mockOnChange}
      />
    );

    // Wait for units to load and selector to appear
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Unit' })).toBeInTheDocument();
    });
  });

  it('should pre-select unit when selecting ingredient from autocomplete', async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    // Wrapper hybride: state reel mais on espie les appels
    const SpyWrapper = () => {
      const [ingredients, setIngredients] = reactUseState<IngredientInput[]>([{ name: '' }]);
      const handleChange = (updated: IngredientInput[]) => {
        setIngredients(updated);
        onChangeSpy(updated);
      };
      return <IngredientList value={ingredients} onChange={handleChange} />;
    };

    render(<SpyWrapper />);

    const nameInput = screen.getByPlaceholderText('Ingredient name');
    await user.type(nameInput, 'sug');

    await waitFor(() => {
      expect(screen.getByText('sugar')).toBeInTheDocument();
    }, { timeout: 2000 });

    await user.click(screen.getByText('sugar'));

    // Should pre-select the unit from getSuggestedUnit (unit-1 = 'g' for ing-1)
    await waitFor(() => {
      const calls = onChangeSpy.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall[0].unitId).toBe('unit-1');
      expect(lastCall[0].ingredientId).toBe('ing-1');
    }, { timeout: 2000 });
  });
});
