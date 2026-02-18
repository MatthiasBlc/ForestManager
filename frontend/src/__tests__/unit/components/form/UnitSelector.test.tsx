import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import UnitSelector from '../../../../components/form/UnitSelector';
import { UnitsByCategory } from '../../../../models/recipe';

const mockUnits: UnitsByCategory = {
  WEIGHT: [
    { id: 'unit-1', name: 'gramme', abbreviation: 'g', category: 'WEIGHT', sortOrder: 1 },
    { id: 'unit-2', name: 'kilogramme', abbreviation: 'kg', category: 'WEIGHT', sortOrder: 2 },
  ],
  VOLUME: [
    { id: 'unit-3', name: 'centilitre', abbreviation: 'cl', category: 'VOLUME', sortOrder: 2 },
  ],
  COUNT: [
    { id: 'unit-4', name: 'piece', abbreviation: 'pc', category: 'COUNT', sortOrder: 1 },
  ],
};

describe('UnitSelector', () => {
  it('should render a select with default empty option', () => {
    render(<UnitSelector value={null} onChange={vi.fn()} units={mockUnits} />);

    const select = screen.getByRole('combobox', { name: 'Unit' });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unit' })).toBeInTheDocument();
  });

  it('should render optgroups by category', () => {
    render(<UnitSelector value={null} onChange={vi.fn()} units={mockUnits} />);

    expect(screen.getByRole('option', { name: 'g' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'kg' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'cl' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'pc' })).toBeInTheDocument();
  });

  it('should show selected unit', () => {
    render(<UnitSelector value="unit-1" onChange={vi.fn()} units={mockUnits} />);

    const select = screen.getByRole('combobox', { name: 'Unit' }) as HTMLSelectElement;
    expect(select.value).toBe('unit-1');
  });

  it('should call onChange with unit id when selection changes', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<UnitSelector value={null} onChange={mockOnChange} units={mockUnits} />);

    const select = screen.getByRole('combobox', { name: 'Unit' });
    await user.selectOptions(select, 'unit-1');

    expect(mockOnChange).toHaveBeenCalledWith('unit-1');
  });

  it('should call onChange with null when empty option is selected', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<UnitSelector value="unit-1" onChange={mockOnChange} units={mockUnits} />);

    const select = screen.getByRole('combobox', { name: 'Unit' });
    await user.selectOptions(select, '');

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('should be disabled when units object is empty', () => {
    render(<UnitSelector value={null} onChange={vi.fn()} units={{}} />);

    const select = screen.getByRole('combobox', { name: 'Unit' });
    expect(select).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<UnitSelector value={null} onChange={vi.fn()} units={mockUnits} disabled />);

    const select = screen.getByRole('combobox', { name: 'Unit' });
    expect(select).toBeDisabled();
  });

  it('should not render empty categories', () => {
    const sparseUnits: UnitsByCategory = {
      WEIGHT: [
        { id: 'unit-1', name: 'gramme', abbreviation: 'g', category: 'WEIGHT', sortOrder: 1 },
      ],
    };

    render(<UnitSelector value={null} onChange={vi.fn()} units={sparseUnits} />);

    // VOLUME/COUNT/SPOON/QUALITATIVE optgroups should not be present
    expect(screen.queryByRole('option', { name: 'cl' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'pc' })).not.toBeInTheDocument();
  });
});
