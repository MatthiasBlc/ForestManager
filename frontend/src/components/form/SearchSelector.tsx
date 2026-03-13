import { useState, useRef, useCallback, ReactNode } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useDebouncedEffect } from "../../hooks/useDebouncedEffect";

interface SearchSelectorProps<T extends { id: string; name: string }> {
  value: string[];
  onChange: (values: string[]) => void;
  searchFn: (query: string, limit: number) => Promise<T[]>;
  placeholder?: string;
  chipClassName?: string;
  allowCreate?: boolean;
  renderSuggestion?: (item: T) => ReactNode;
  renderCreateLabel?: (input: string) => ReactNode;
  noResultsMessage?: string;
  emptyMessage?: string;
}

function SearchSelector<T extends { id: string; name: string }>({
  value,
  onChange,
  searchFn,
  placeholder = "Search...",
  chipClassName = "bg-primary text-primary-content",
  allowCreate = false,
  renderSuggestion,
  renderCreateLabel,
  noResultsMessage = "No results found",
  emptyMessage = "No items available",
}: SearchSelectorProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDebouncedEffect(
    () => {
      if (!showDropdown) return;

      setIsLoading(true);
      searchFn(inputValue.trim(), 10)
        .then((results) => setSuggestions(results.filter((item) => !value.includes(item.name))))
        .catch(() => setSuggestions([]))
        .finally(() => setIsLoading(false));
    },
    inputValue ? 300 : 0,
    [inputValue, value, showDropdown]
  );

  useClickOutside(
    containerRef,
    useCallback(() => setShowDropdown(false), [])
  );

  const addItem = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInputValue("");
    setShowDropdown(false);
  };

  const removeItem = (itemToRemove: string) => {
    onChange(value.filter((item) => item !== itemToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputValue.trim().toLowerCase();
      if (trimmed && allowCreate) {
        addItem(trimmed);
      } else if (suggestions.length > 0) {
        addItem(suggestions[0].name);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeItem(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const showCreateOption =
    allowCreate &&
    inputValue.trim() &&
    !value.includes(inputValue.trim().toLowerCase()) &&
    !suggestions.some((s) => s.name === inputValue.trim().toLowerCase());

  const defaultRenderSuggestion = (item: T) => <span>{item.name}</span>;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-base-100 min-h-[42px]">
        {value.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-lg ${chipClassName}`}
          >
            {item}
            <button
              type="button"
              onClick={() => removeItem(item)}
              className="hover:opacity-70"
              aria-label={`Remove ${item}`}
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
                  onClick={() => addItem(suggestion.name)}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex justify-between items-center"
                >
                  {(renderSuggestion ?? defaultRenderSuggestion)(suggestion)}
                </button>
              ))}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => addItem(inputValue.trim())}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex items-center gap-2 border-t"
                >
                  <FaPlus size={12} />
                  {renderCreateLabel ? (
                    renderCreateLabel(inputValue.trim().toLowerCase())
                  ) : (
                    <span>Create &quot;{inputValue.trim().toLowerCase()}&quot;</span>
                  )}
                </button>
              )}
              {suggestions.length === 0 && !showCreateOption && !isLoading && (
                <div className="px-3 py-2 text-base-content/60">
                  {inputValue.trim() ? noResultsMessage : emptyMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchSelector;
