import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import { RecipeListItem, CommunityRecipeListItem } from "../../models/recipe";
import { formatDate } from "../../utils/format.Date";

interface RecipeCardProps {
  recipe: RecipeListItem | CommunityRecipeListItem;
  onDelete: (recipe: RecipeListItem | CommunityRecipeListItem) => void;
  onTagClick?: (tag: string) => void;
  showCreator?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const RecipeCard = ({ recipe, onDelete, onTagClick, showCreator = false, canEdit = true, canDelete = true }: RecipeCardProps) => {
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
      className="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
      onClick={handleClick}
    >
      {imageUrl ? (
        <figure className="h-48 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </figure>
      ) : (
        <figure className="h-48 bg-base-200 flex items-center justify-center">
          <span className="text-4xl text-base-content/30">No image</span>
        </figure>
      )}
      <div className="card-body">
        <h2 className="card-title">{title}</h2>
        {showCreator && "creator" in recipe && (
          <p className="text-sm text-base-content/60">by {(recipe as CommunityRecipeListItem).creator.username}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
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

        <p className="text-sm text-base-content/60 mt-2">{dateText}</p>

        {(canEdit || canDelete) && (
          <div className="card-actions justify-end mt-2">
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
    </div>
  );
};

export default RecipeCard;
