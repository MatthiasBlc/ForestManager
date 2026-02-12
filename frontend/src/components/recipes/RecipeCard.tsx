import { FaEdit, FaTrash, FaCodeBranch, FaShare } from "react-icons/fa";
import { RecipeListItem, CommunityRecipeListItem } from "../../models/recipe";
import { useRecipeActions } from "../../hooks/useRecipeActions";

interface RecipeCardProps {
  recipe: RecipeListItem | CommunityRecipeListItem;
  onDelete: (recipe: RecipeListItem | CommunityRecipeListItem) => void;
  onTagClick?: (tag: string) => void;
  onShare?: (recipe: RecipeListItem) => void;
  showCreator?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const RecipeCard = ({ recipe, onDelete, onTagClick, onShare, showCreator = false, canEdit = true, canDelete = true }: RecipeCardProps) => {
  const {
    title, imageUrl, tags, displayedTags, remainingTagsCount, dateText,
    communityRecipe, isSharedRecipe,
    handleClick, handleEdit, handleDelete, handleTagClick, handleShare,
    ConfirmDialog,
  } = useRecipeActions({ recipe, onDelete, onTagClick, onShare });

  return (
    <div
      className="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
      onClick={handleClick}
    >
      {imageUrl ? (
        <figure className="h-48 overflow-hidden">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        </figure>
      ) : (
        <figure className="h-48 bg-base-200 flex items-center justify-center">
          <span className="text-4xl text-base-content/30">No image</span>
        </figure>
      )}
      <div className="card-body">
        <h2 className="card-title">{title}</h2>
        {showCreator && communityRecipe && (
          <p className="text-sm text-base-content/60">by {communityRecipe.creator.username}</p>
        )}
        {isSharedRecipe && communityRecipe && (
          <span className="badge badge-outline badge-info badge-sm gap-1">
            <FaCodeBranch className="w-2.5 h-2.5" />
            Shared by: {communityRecipe.creator.username}
          </span>
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
              <span className="badge badge-ghost badge-sm">+{remainingTagsCount}</span>
            )}
          </div>
        )}

        <p className="text-sm text-base-content/60 mt-2">{dateText}</p>

        {(canEdit || canDelete || handleShare) && (
          <div className="card-actions justify-end mt-2">
            {handleShare && (
              <button className="btn btn-ghost btn-sm" onClick={handleShare}>
                <FaShare />
              </button>
            )}
            {canEdit && (
              <button className="btn btn-ghost btn-sm" onClick={handleEdit}>
                <FaEdit />
              </button>
            )}
            {canDelete && (
              <button className="btn btn-ghost btn-sm text-error" onClick={handleDelete}>
                <FaTrash />
              </button>
            )}
          </div>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
};

export default RecipeCard;
