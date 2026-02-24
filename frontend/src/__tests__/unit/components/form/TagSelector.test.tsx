import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import TagSelector from '../../../../components/form/TagSelector';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';

describe('TagSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    setUserAuthenticated(true);
  });

  it('should render with placeholder when empty', () => {
    render(
      <TagSelector
        value={[]}
        onChange={mockOnChange}
        placeholder="Search tags..."
      />
    );

    expect(screen.getByPlaceholderText('Search tags...')).toBeInTheDocument();
  });

  it('should display selected tags', () => {
    render(
      <TagSelector
        value={['dessert', 'chocolate']}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('dessert')).toBeInTheDocument();
    expect(screen.getByText('chocolate')).toBeInTheDocument();
  });

  it('should call onChange when removing a tag', async () => {
    const user = userEvent.setup();
    render(
      <TagSelector
        value={['dessert', 'chocolate']}
        onChange={mockOnChange}
      />
    );

    // Find remove button for dessert tag
    const dessertTag = screen.getByText('dessert').closest('span');
    const removeButton = dessertTag?.querySelector('button');

    if (removeButton) {
      await user.click(removeButton);
    }

    expect(mockOnChange).toHaveBeenCalledWith(['chocolate']);
  });

  it('should show dropdown on focus', async () => {
    const user = userEvent.setup();
    render(
      <TagSelector
        value={[]}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    await user.click(input);

    // Dropdown should appear
    await waitFor(() => {
      expect(document.querySelector('.shadow-lg')).toBeInTheDocument();
    });
  });

  it('should hide placeholder when tags are selected', () => {
    render(
      <TagSelector
        value={['dessert']}
        onChange={mockOnChange}
        placeholder="Search tags..."
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('placeholder', 'Search tags...');
  });

  it('should add tag on Enter when allowCreate is true', async () => {
    const user = userEvent.setup();
    render(
      <TagSelector
        value={[]}
        onChange={mockOnChange}
        allowCreate={true}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'newtag{Enter}');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
    });
  });

  it('should remove last tag on Backspace when input is empty', async () => {
    const user = userEvent.setup();
    render(
      <TagSelector
        value={['dessert', 'chocolate']}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(mockOnChange).toHaveBeenCalledWith(['dessert']);
  });

  it('should accept communityId prop without error', () => {
    render(
      <TagSelector
        value={[]}
        onChange={mockOnChange}
        communityId="community-123"
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should show pending hint when creating tag with communityId', async () => {
    const user = userEvent.setup();
    render(
      <TagSelector
        value={[]}
        onChange={mockOnChange}
        allowCreate={true}
        communityId="community-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'unknowntag');

    await waitFor(() => {
      expect(screen.getByText('(will be pending)')).toBeInTheDocument();
    });
  });
});
