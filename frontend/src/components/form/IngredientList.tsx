import { useState, useRef, useCallback, useEffect } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import APIManager from "../../network/api";
import { IngredientSearchResult, UnitsByCategory } from "../../models/recipe";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useDebouncedEffect } from "../../hooks/useDebouncedEffect";
import UnitSelector from "./UnitSelector";

export interface IngredientInput {
  name: string;
  quantity?: number;
  unitId?: string;
  ingredientId?: string;
}

interface IngredientListProps {
  value: IngredientInput[];
  onChange: (ingredients: IngredientInput[]) => void;
}

interface IngredientRowProps {
  ingredient: IngredientInput;
  index: number;
  units: UnitsByCategory;
  onUpdate: (index: number, ingredient: IngredientInput) => void;
  onRemove: (index: number) => void;
}

const IngredientRow = ({ ingredient, index, units, onUpdate, onRemove }: IngredientRowProps) => {
  const [suggestions, setSuggestions] = useState<IngredientSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDebouncedEffect(() => {
    const search = ingredient.name.trim();
    if (!search) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    APIManager.searchIngredients(search, 10)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setIsLoading(false));
  }, 300, [ingredient.name]);

  useClickOutside(containerRef, useCallback(() => setShowDropdown(false), []));

  const selectSuggestion = async (suggestion: IngredientSearchResult) => {
    setShowDropdown(false);
    let unitId = ingredient.unitId;

    try {
      const suggested = await APIManager.getSuggestedUnit(suggestion.id);
      if (suggested.suggestedUnitId) {
        unitId = suggested.suggestedUnitId;
      }
    } catch {
      // Ignore pre-selection errors
    }

    onUpdate(index, { ...ingredient, name: suggestion.name, ingredientId: suggestion.id, unitId });
  };

  return (
    <div className="flex gap-2 items-start">
      <div ref={containerRef} className="relative flex-1">
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => {
            onUpdate(index, { ...ingredient, name: e.target.value, ingredientId: undefined });
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
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-base-200 flex justify-between items-center"
                >
                  <span className="flex items-center gap-2">
                    {suggestion.name}
                    {suggestion.status === "PENDING" && (
                      <span className="badge badge-warning badge-xs">nouveau</span>
                    )}
                  </span>
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
        type="number"
        value={ingredient.quantity ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onUpdate(index, { ...ingredient, quantity: val ? parseFloat(val) : undefined });
        }}
        placeholder="Qty"
        min={0}
        step="any"
        className="input input-bordered w-24"
      />
      <UnitSelector
        value={ingredient.unitId ?? null}
        onChange={(unitId) => onUpdate(index, { ...ingredient, unitId: unitId ?? undefined })}
        units={units}
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="btn btn-ghost btn-square text-error"
        aria-label="Remove ingredient"
      >
        <FaTimes />
      </button>
    </div>
  );
};

const IngredientList = ({ value, onChange }: IngredientListProps) => {
  const nextId = useRef(0);
  const [itemIds, setItemIds] = useState<number[]>(() =>
    value.map(() => nextId.current++)
  );
  const [units, setUnits] = useState<UnitsByCategory>({});

  // Charge les unites une seule fois au montage
  useEffect(() => {
    APIManager.getUnits()
      .then(setUnits)
      .catch(() => setUnits({}));
  }, []);

  // Sync itemIds when value length changes externally (e.g. form reset)
  useEffect(() => {
    if (value.length !== itemIds.length) {
      setItemIds(value.map(() => nextId.current++));
    }
  }, [value.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addIngredient = () => {
    onChange([...value, { name: "" }]);
    setItemIds([...itemIds, nextId.current++]);
  };

  const updateIngredient = (index: number, ingredient: IngredientInput) => {
    const updated = [...value];
    updated[index] = ingredient;
    onChange(updated);
  };

  const removeIngredient = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    setItemIds(itemIds.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {value.map((ingredient, index) => (
        <IngredientRow
          key={itemIds[index]}
          ingredient={ingredient}
          index={index}
          units={units}
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
