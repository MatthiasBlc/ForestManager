import { useNavigate } from "react-router-dom";
import { RecipeListItem, CommunityRecipeListItem } from "../models/recipe";
import { formatDate } from "../utils/format.Date";
import { useConfirm } from "./useConfirm";

type Recipe = RecipeListItem | CommunityRecipeListItem;

interface UseRecipeActionsProps {
  recipe: Recipe;
  onDelete: (recipe: Recipe) => void;
  onTagClick?: (tag: string) => void;
  onShare?: (recipe: RecipeListItem) => void;
}

export function useRecipeActions({ recipe, onDelete, onTagClick, onShare }: UseRecipeActionsProps) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const { title, imageUrl, createdAt, updatedAt, tags } = recipe;

  const displayedTags = tags.slice(0, 3);
  const remainingTagsCount = tags.length - 3;

  const dateText =
    updatedAt > createdAt
      ? `Updated: ${formatDate(updatedAt)}`
      : `Created: ${formatDate(createdAt)}`;

  const isCommunityRecipe = "creator" in recipe;
  const communityRecipe = isCommunityRecipe ? (recipe as CommunityRecipeListItem) : null;
  const isSharedRecipe = communityRecipe?.sharedFromCommunityId != null;

  const handleClick = () => navigate(`/recipes/${recipe.id}`);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/recipes/${recipe.id}/edit`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm({ message: "Are you sure you want to delete this recipe?", confirmLabel: "Delete", confirmClass: "btn btn-error" })) {
      onDelete(recipe);
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    onTagClick?.(tag);
  };

  const handleShare = onShare ? (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(recipe);
  } : undefined;

  return {
    title,
    imageUrl,
    tags,
    displayedTags,
    remainingTagsCount,
    dateText,
    communityRecipe,
    isSharedRecipe,
    handleClick,
    handleEdit,
    handleDelete,
    handleTagClick,
    handleShare,
    ConfirmDialog,
  };
}
