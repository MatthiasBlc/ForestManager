import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import RecipeCard from '../../../../components/recipes/RecipeCard';
import { RecipeListItem } from '../../../../models/recipe';

const mockRecipe: RecipeListItem = {
  id: 'recipe-1',
  title: 'Test Recipe',
  imageUrl: 'https://example.com/image.jpg',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  tags: [
    { id: 'tag-1', name: 'dessert' },
    { id: 'tag-2', name: 'chocolate' },
    { id: 'tag-3', name: 'easy' },
    { id: 'tag-4', name: 'quick' },
  ],
};

describe('RecipeCard', () => {
  const mockOnDelete = vi.fn();
  const mockOnTagClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm to return true
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('should render recipe title', () => {
    render(
      <RecipeCard recipe={mockRecipe} onDelete={mockOnDelete} />
    );

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should render recipe image', () => {
    render(
      <RecipeCard recipe={mockRecipe} onDelete={mockOnDelete} />
    );

    const image = screen.getByAltText('Test Recipe');
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should show "No image" when imageUrl is null', () => {
    const recipeWithoutImage = { ...mockRecipe, imageUrl: null };
    render(
      <RecipeCard recipe={recipeWithoutImage} onDelete={mockOnDelete} />
    );

    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('should display max 3 tags and show remaining count', () => {
    render(
      <RecipeCard recipe={mockRecipe} onDelete={mockOnDelete} />
    );

    // First 3 tags should be visible
    expect(screen.getByText('dessert')).toBeInTheDocument();
    expect(screen.getByText('chocolate')).toBeInTheDocument();
    expect(screen.getByText('easy')).toBeInTheDocument();

    // 4th tag should be hidden, show +1
    expect(screen.queryByText('quick')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should call onTagClick when clicking a tag', async () => {
    const user = userEvent.setup();
    render(
      <RecipeCard
        recipe={mockRecipe}
        onDelete={mockOnDelete}
        onTagClick={mockOnTagClick}
      />
    );

    await user.click(screen.getByText('dessert'));

    expect(mockOnTagClick).toHaveBeenCalledWith('dessert');
  });

  it('should call onDelete when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup();
    render(
      <RecipeCard recipe={mockRecipe} onDelete={mockOnDelete} />
    );

    // Find and click delete button (button with trash icon)
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn =>
      btn.classList.contains('text-error')
    );

    if (deleteButton) {
      await user.click(deleteButton);
    }

    expect(mockOnDelete).toHaveBeenCalledWith(mockRecipe);
  });

  it('should display created date when not updated', () => {
    render(
      <RecipeCard recipe={mockRecipe} onDelete={mockOnDelete} />
    );

    expect(screen.getByText(/Created:/)).toBeInTheDocument();
  });

  it('should display updated date when recipe was updated', () => {
    const updatedRecipe = {
      ...mockRecipe,
      updatedAt: '2024-06-01T00:00:00.000Z',
    };
    render(
      <RecipeCard recipe={updatedRecipe} onDelete={mockOnDelete} />
    );

    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
  });
});
