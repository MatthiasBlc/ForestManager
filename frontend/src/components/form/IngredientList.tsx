import { useState, useEffect, useRef, useCallback } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import APIManager from "../../network/api";
import { IngredientSearchResult } from "../../models/recipe";

export interface IngredientInput {
  name: string;
  quantity: string;
}

interface IngredientListProps {
  value: IngredientInput[];
  onChange: (ingredients: IngredientInput[]) => void;
}

interface IngredientRowProps {
  ingredient: IngredientInput;
  index: number;
  onUpdate: (index: number, ingredient: IngredientInput) => void;
  onRemove: (index: number) => void;
}

const IngredientRow = ({ ingredient, index, onUpdate, onRemove }: IngredientRowProps) => {
  const [suggestions, setSuggestions] = useState<IngredientSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchIngredients = useCallback(async (search: string) => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await APIManager.searchIngredients(search.trim(), 10);
      setSuggestions(results);
    } catch (error) {
      console.error("Error searching ingredients:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchIngredients(ingredient.name);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [ingredient.name, searchIngredients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (name: string) => {
    onUpdate(index, { ...ingredient, name });
    setShowDropdown(false);
  };

  return (
    <div className="flex gap-2 items-start">
      <div ref={containerRef} className="relative flex-1">
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => {
            onUpdate(index, { ...ingredient, name: e.target.value });
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Ingredient name"
          className="input input-bordered w-full"
        />
        {showDropdown && ingredient.name.trim() && (
          <div className="absolute z-10 w-full mt-1 bg-base-100 border rounded-lg shadow-lg max-h-48 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => selectSuggestion(suggestion.name)}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex justify-between items-center"
                >
                  <span>{suggestion.name}</span>
                  <span className="text-xs text-base-content/60">
                    {suggestion.recipeCount} recipe{suggestion.recipeCount !== 1 ? "s" : ""}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-base-content/60 text-sm">
                New ingredient: "{ingredient.name.trim().toLowerCase()}"
              </div>
            )}
          </div>
        )}
      </div>
      <input
        type="text"
        value={ingredient.quantity}
        onChange={(e) => onUpdate(index, { ...ingredient, quantity: e.target.value })}
        placeholder="Quantity (optional)"
        className="input input-bordered w-32"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="btn btn-ghost btn-square text-error"
      >
        <FaTimes />
      </button>
    </div>
  );
};

const IngredientList = ({ value, onChange }: IngredientListProps) => {
  const addIngredient = () => {
    onChange([...value, { name: "", quantity: "" }]);
  };

  const updateIngredient = (index: number, ingredient: IngredientInput) => {
    const updated = [...value];
    updated[index] = ingredient;
    onChange(updated);
  };

  const removeIngredient = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {value.map((ingredient, index) => (
        <IngredientRow
          key={index}
          ingredient={ingredient}
          index={index}
          onUpdate={updateIngredient}
          onRemove={removeIngredient}
        />
      ))}
      <button
        type="button"
        onClick={addIngredient}
        className="btn btn-outline btn-sm gap-2"
      >
        <FaPlus size={12} />
        Add ingredient
      </button>
    </div>
  );
};

export default IngredientList;
