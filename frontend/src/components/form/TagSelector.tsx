import { useState, useEffect, useRef, useCallback } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import APIManager from "../../network/api";
import { TagSearchResult } from "../../models/recipe";

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allowCreate?: boolean;
}

const TagSelector = ({
  value,
  onChange,
  placeholder = "Search tags...",
  allowCreate = true,
}: TagSelectorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<TagSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchTags = useCallback(async (search: string) => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await APIManager.searchTags(search.trim(), 10);
      setSuggestions(results.filter((tag) => !value.includes(tag.name)));
    } catch (error) {
      console.error("Error searching tags:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchTags(inputValue);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, searchTags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = (tagName: string) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (normalizedTag && !value.includes(normalizedTag)) {
      onChange([...value, normalizedTag]);
    }
    setInputValue("");
    setShowDropdown(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedValue = inputValue.trim().toLowerCase();
      if (trimmedValue && allowCreate) {
        addTag(trimmedValue);
      } else if (suggestions.length > 0) {
        addTag(suggestions[0].name);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const showCreateOption =
    allowCreate &&
    inputValue.trim() &&
    !value.includes(inputValue.trim().toLowerCase()) &&
    !suggestions.some((s) => s.name === inputValue.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-base-100 min-h-[42px]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-primary text-primary-content rounded-lg"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
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

      {showDropdown && (inputValue.trim() || isLoading) && (
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
                  onClick={() => addTag(suggestion.name)}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex justify-between items-center"
                >
                  <span>{suggestion.name}</span>
                  <span className="text-xs text-base-content/60">
                    {suggestion.recipeCount} recipe{suggestion.recipeCount !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => addTag(inputValue.trim())}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex items-center gap-2 border-t"
                >
                  <FaPlus size={12} />
                  <span>Create "{inputValue.trim().toLowerCase()}"</span>
                </button>
              )}
              {suggestions.length === 0 && !showCreateOption && (
                <div className="px-3 py-2 text-base-content/60">No tags found</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;
