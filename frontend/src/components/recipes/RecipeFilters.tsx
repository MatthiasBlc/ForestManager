import { useState, useEffect } from "react";
import { FaSearch, FaTimes, FaFilter, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useDebouncedEffect } from "../../hooks/useDebouncedEffect";
import { useIsMobile } from "../../hooks/useIsMobile";
import TagSelector from "../form/TagSelector";
import IngredientSelector from "../form/IngredientSelector";

interface RecipeFiltersProps {
  search: string;
  tags: string[];
  ingredients: string[];
  onSearchChange: (search: string) => void;
  onTagsChange: (tags: string[]) => void;
  onIngredientsChange: (ingredients: string[]) => void;
  onReset: () => void;
  communityId?: string;
}

const RecipeFilters = ({
  search,
  tags,
  ingredients,
  onSearchChange,
  onTagsChange,
  onIngredientsChange,
  onReset,
  communityId,
}: RecipeFiltersProps) => {
  const [localSearch, setLocalSearch] = useState(search);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useDebouncedEffect(
    () => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    },
    300,
    [localSearch, search, onSearchChange]
  );

  const hasFilters = search || tags.length > 0 || ingredients.length > 0;
  const activeFilterCount = (tags.length > 0 ? 1 : 0) + (ingredients.length > 0 ? 1 : 0);

  const filterFields = (
    <>
      <div className="flex-1 md:min-w-[200px]">
        <label className="label">
          <span className="label-text">Filter by tags</span>
        </label>
        <TagSelector
          value={tags}
          onChange={onTagsChange}
          placeholder="Select tags..."
          allowCreate={false}
          communityId={communityId}
        />
      </div>

      <div className="flex-1 md:min-w-[200px]">
        <label className="label">
          <span className="label-text">Filter by ingredients</span>
        </label>
        <IngredientSelector
          value={ingredients}
          onChange={onIngredientsChange}
          placeholder="Select ingredients..."
        />
      </div>
    </>
  );

  return (
    <div className="space-y-4 p-4 bg-base-200 rounded-lg">
      {/* Search - always visible */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 md:min-w-[200px]">
          <label className="label">
            <span className="label-text">Search</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by title..."
              className="input input-bordered w-full pl-10"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          </div>
        </div>

        {/* Desktop: inline filters */}
        {!isMobile && filterFields}
      </div>

      {/* Mobile: collapsible filters */}
      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="btn btn-ghost btn-sm gap-2 w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <FaFilter className="w-3 h-3" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="badge badge-primary badge-sm">{activeFilterCount}</span>
              )}
            </span>
            {filtersExpanded ? (
              <FaChevronUp className="w-3 h-3" />
            ) : (
              <FaChevronDown className="w-3 h-3" />
            )}
          </button>
          {filtersExpanded && <div className="space-y-4 transition-all">{filterFields}</div>}
        </>
      )}

      {hasFilters && (
        <div className="flex justify-end">
          <button type="button" onClick={onReset} className="btn btn-ghost btn-sm gap-2">
            <FaTimes size={12} />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipeFilters;
