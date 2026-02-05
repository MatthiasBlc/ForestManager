import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash, FaCodeBranch } from "react-icons/fa";
import { RecipeListItem, CommunityRecipeListItem } from "../../models/recipe";
import { formatDate } from "../../utils/format.Date";

interface RecipeListRowProps {
  recipe: RecipeListItem | CommunityRecipeListItem;
  onDelete: (recipe: RecipeListItem | CommunityRecipeListItem) => void;
  onTagClick?: (tag: string) => void;
  showCreator?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const RecipeListRow = ({ recipe, onDelete, onTagClick, showCreator = false, canEdit = true, canDelete = true }: RecipeListRowProps) => {
  const navigate = useNavigate();
  const { title, imageUrl, createdAt, updatedAt, tags } = recipe;

  const displayedTags = tags.slice(0, 3);
  const remainingTagsCount = tags.length - 3;

  const dateText =
    updatedAt > createdAt
      ? `Updated: ${formatDate(updatedAt)}`
      : `Created: ${formatDate(createdAt)}`;

  const handleClick = () => {
    navigate(`/recipes/${recipe.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/recipes/${recipe.id}/edit`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this recipe?")) {
      onDelete(recipe);
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <div
      className="flex items-center gap-4 p-4 bg-base-100 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      {imageUrl ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-base-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-base-content/30">No img</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {showCreator && "creator" in recipe && (
            <p className="text-xs text-base-content/50">by {(recipe as CommunityRecipeListItem).creator.username}</p>
          )}
          {"sharedFromCommunity" in recipe && (recipe as CommunityRecipeListItem).sharedFromCommunity && (
            <span className="badge badge-outline badge-info badge-xs gap-1">
              <FaCodeBranch className="w-2 h-2" />
              From: {(recipe as CommunityRecipeListItem).sharedFromCommunity!.name}
            </span>
          )}
        </div>
        <p className="text-sm text-base-content/60">{dateText}</p>
      </div>

      {tags.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1 max-w-48">
          {displayedTags.map((tag) => (
            <span
              key={tag.id}
              onClick={(e) => handleTagClick(e, tag.name)}
              className="badge badge-primary badge-sm cursor-pointer hover:badge-secondary"
            >
              {tag.name}
            </span>
          ))}
          {remainingTagsCount > 0 && (
            <span className="badge badge-ghost badge-sm">
              +{remainingTagsCount}
            </span>
          )}
        </div>
      )}

      {(canEdit || canDelete) && (
        <div className="flex gap-1 flex-shrink-0">
          {canEdit && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleEdit}
            >
              <FaEdit />
            </button>
          )}
          {canDelete && (
            <button
              className="btn btn-ghost btn-sm text-error"
              onClick={handleDelete}
            >
              <FaTrash />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipeListRow;
