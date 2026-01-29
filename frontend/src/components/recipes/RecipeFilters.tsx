import { useState, useEffect, useRef } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
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
}

const RecipeFilters = ({
  search,
  tags,
  ingredients,
  onSearchChange,
  onTagsChange,
  onIngredientsChange,
  onReset,
}: RecipeFiltersProps) => {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localSearch, search, onSearchChange]);

  const hasFilters = search || tags.length > 0 || ingredients.length > 0;

  return (
    <div className="space-y-4 p-4 bg-base-200 rounded-lg">
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
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

        <div className="flex-1 min-w-[200px]">
          <label className="label">
            <span className="label-text">Filter by tags</span>
          </label>
          <TagSelector
            value={tags}
            onChange={onTagsChange}
            placeholder="Select tags..."
            allowCreate={false}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="label">
            <span className="label-text">Filter by ingredients</span>
          </label>
          <IngredientSelector
            value={ingredients}
            onChange={onIngredientsChange}
            placeholder="Select ingredients..."
          />
        </div>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="btn btn-ghost btn-sm gap-2"
          >
            <FaTimes size={12} />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipeFilters;
