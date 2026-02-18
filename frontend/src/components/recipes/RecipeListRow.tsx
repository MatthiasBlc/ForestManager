import { FaEdit, FaTrash, FaCodeBranch, FaShare } from "react-icons/fa";
import { RecipeListItem, CommunityRecipeListItem } from "../../models/recipe";
import { useRecipeActions } from "../../hooks/useRecipeActions";
import TagBadge from "./TagBadge";

interface RecipeListRowProps {
  recipe: RecipeListItem | CommunityRecipeListItem;
  onDelete: (recipe: RecipeListItem | CommunityRecipeListItem) => void;
  onTagClick?: (tag: string) => void;
  onShare?: (recipe: RecipeListItem) => void;
  showCreator?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const RecipeListRow = ({ recipe, onDelete, onTagClick, onShare, showCreator = false, canEdit = true, canDelete = true }: RecipeListRowProps) => {
  const {
    title, imageUrl, tags, displayedTags, remainingTagsCount, dateText,
    communityRecipe, isSharedRecipe,
    handleClick, handleEdit, handleDelete, handleTagClick, handleShare,
    ConfirmDialog,
  } = useRecipeActions({ recipe, onDelete, onTagClick, onShare });

  return (
    <div
      className="flex items-center gap-4 p-4 bg-base-100 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      {imageUrl ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-base-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-base-content/30">No img</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {showCreator && communityRecipe && (
            <p className="text-xs text-base-content/50">by {communityRecipe.creator.username}</p>
          )}
          {isSharedRecipe && communityRecipe && (
            <span className="badge badge-outline badge-info badge-xs gap-1">
              <FaCodeBranch className="w-2 h-2" />
              Shared by: {communityRecipe.creator.username}
            </span>
          )}
        </div>
        <p className="text-sm text-base-content/60">{dateText}</p>
      </div>

      {tags.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1 max-w-48">
          {displayedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="sm"
              onClick={(e) => handleTagClick(e, tag.name)}
            />
          ))}
          {remainingTagsCount > 0 && (
            <span className="badge badge-ghost badge-sm">+{remainingTagsCount}</span>
          )}
        </div>
      )}

      {(canEdit || canDelete || handleShare) && (
        <div className="flex gap-1 flex-shrink-0">
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
      {ConfirmDialog}
    </div>
  );
};

export default RecipeListRow;
