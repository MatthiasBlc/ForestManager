import APIManager from "../../network/api";
import { IngredientSearchResult } from "../../models/recipe";
import SearchSelector from "./SearchSelector";

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
  const searchFn = (query: string, limit: number) => APIManager.searchIngredients(query, limit);

  const renderSuggestion = (ingredient: IngredientSearchResult) => (
    <>
      <span>{ingredient.name}</span>
      <span className="text-xs text-base-content/60">
        {ingredient.recipeCount} recipe{ingredient.recipeCount !== 1 ? "s" : ""}
      </span>
    </>
  );

  return (
    <SearchSelector<IngredientSearchResult>
      value={value}
      onChange={onChange}
      searchFn={searchFn}
      placeholder={placeholder}
      chipClassName="bg-secondary text-secondary-content"
      renderSuggestion={renderSuggestion}
      noResultsMessage="No ingredients found"
      emptyMessage="No ingredients available"
    />
  );
};

export default IngredientSelector;
