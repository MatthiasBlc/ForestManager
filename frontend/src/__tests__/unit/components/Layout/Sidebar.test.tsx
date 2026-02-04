import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import Sidebar from '../../../../components/Layout/Sidebar';

describe('Sidebar', () => {
  const mockOnNavigate = vi.fn();
  const mockOnToggleCompact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render navigation menu items', () => {
    render(<Sidebar />);

    expect(screen.getByText('My Recipes')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
  });

  it('should render create community link', () => {
    render(<Sidebar />);

    expect(screen.getByText('Create Community')).toBeInTheDocument();
  });

  it('should render version number', () => {
    render(<Sidebar />);

    expect(screen.getByText(/v0\.1/)).toBeInTheDocument();
  });

  it('should call onNavigate when clicking a menu item', async () => {
    const user = userEvent.setup();
    render(<Sidebar onNavigate={mockOnNavigate} />);

    await user.click(screen.getByText('My Recipes'));

    expect(mockOnNavigate).toHaveBeenCalled();
  });

  it('should show compact view when isCompact is true', () => {
    render(<Sidebar isCompact={true} />);

    // In compact mode, labels should be hidden
    expect(screen.queryByText('My Recipes')).not.toBeInTheDocument();
    // But icons should still be present (via tooltips)
  });

  it('should show expanded view when isCompact is false', () => {
    render(<Sidebar isCompact={false} />);

    expect(screen.getByText('My Recipes')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
  });

  it('should call onToggleCompact when toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar onToggleCompact={mockOnToggleCompact} />);

    // Find the toggle button (it's the one with FaBars icon)
    const toggleButton = screen.getByLabelText(/Collapse sidebar|Expand sidebar/);
    await user.click(toggleButton);

    expect(mockOnToggleCompact).toHaveBeenCalled();
  });

  it('should link recipes to correct path', () => {
    render(<Sidebar />);

    const recipesLink = screen.getByText('My Recipes').closest('a');
    expect(recipesLink).toHaveAttribute('href', '/recipes');
  });

  it('should render communities section label', () => {
    render(<Sidebar />);

    expect(screen.getByText('Communities')).toBeInTheDocument();
  });

  it('should link create community to correct path', () => {
    render(<Sidebar />);

    const createLink = screen.getByText('Create Community').closest('a');
    expect(createLink).toHaveAttribute('href', '/communities/create');
  });
});
