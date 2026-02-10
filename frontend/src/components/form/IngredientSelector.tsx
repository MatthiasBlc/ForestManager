import { useState, useRef, useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import APIManager from "../../network/api";
import { IngredientSearchResult } from "../../models/recipe";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useDebouncedEffect } from "../../hooks/useDebouncedEffect";

interface IngredientSelectorProps {
  value: string[];
  onChange: (ingredients: string[]) => void;
  placeholder?: string;
}

const IngredientSelector = ({
  value,
  onChange,
  placeholder = "Search ingredients...",
}: IngredientSelectorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDebouncedEffect(() => {
    if (!showDropdown) return;

    setIsLoading(true);
    APIManager.searchIngredients(inputValue.trim(), 10)
      .then((results) => setSuggestions(results.filter((ingredient) => !value.includes(ingredient.name))))
      .catch(() => setSuggestions([]))
      .finally(() => setIsLoading(false));
  }, inputValue ? 300 : 0, [inputValue, value, showDropdown]);

  useClickOutside(containerRef, useCallback(() => setShowDropdown(false), []));

  const addIngredient = (ingredientName: string) => {
    const normalizedIngredient = ingredientName.trim().toLowerCase();
    if (normalizedIngredient && !value.includes(normalizedIngredient)) {
      onChange([...value, normalizedIngredient]);
    }
    setInputValue("");
    setShowDropdown(false);
  };

  const removeIngredient = (ingredientToRemove: string) => {
    onChange(value.filter((ingredient) => ingredient !== ingredientToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        addIngredient(suggestions[0].name);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeIngredient(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-base-100 min-h-[42px]">
        {value.map((ingredient) => (
          <span
            key={ingredient}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-secondary text-secondary-content rounded-lg"
          >
            {ingredient}
            <button
              type="button"
              onClick={() => removeIngredient(ingredient)}
              className="hover:opacity-70"
            >
              <FaTimes size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-base-100 border rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-center">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : (
            <>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => addIngredient(suggestion.name)}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex justify-between items-center"
                >
                  <span>{suggestion.name}</span>
                  <span className="text-xs text-base-content/60">
                    {suggestion.recipeCount} recipe{suggestion.recipeCount !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
              {suggestions.length === 0 && !isLoading && (
                <div className="px-3 py-2 text-base-content/60">
                  {inputValue.trim() ? "No ingredients found" : "No ingredients available"}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default IngredientSelector;
