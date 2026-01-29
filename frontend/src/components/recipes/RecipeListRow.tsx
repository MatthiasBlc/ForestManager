import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import { RecipeListItem } from "../../models/recipe";
import { formatDate } from "../../utils/format.Date";

interface RecipeListRowProps {
  recipe: RecipeListItem;
  onDelete: (recipe: RecipeListItem) => void;
  onTagClick?: (tag: string) => void;
}

const RecipeListRow = ({ recipe, onDelete, onTagClick }: RecipeListRowProps) => {
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

      <div className="flex gap-1 flex-shrink-0">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleEdit}
        >
          <FaEdit />
        </button>
        <button
          className="btn btn-ghost btn-sm text-error"
          onClick={handleDelete}
        >
          <FaTrash />
        </button>
      </div>
    </div>
  );
};

export default RecipeListRow;
