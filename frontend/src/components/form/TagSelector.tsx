import APIManager from "../../network/api";
import { TagSearchResult } from "../../models/recipe";
import SearchSelector from "./SearchSelector";

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allowCreate?: boolean;
  communityId?: string;
}

const TagSelector = ({
  value,
  onChange,
  placeholder = "Search tags...",
  allowCreate = true,
  communityId,
}: TagSelectorProps) => {
  const searchFn = (query: string, limit: number) =>
    APIManager.searchTags(query, limit, communityId);

  const renderSuggestion = (tag: TagSearchResult) => (
    <>
      <span className="flex items-center gap-2">
        {tag.name}
        {tag.scope && (
          <span className="text-[0.65rem] opacity-50 uppercase">
            {tag.scope === "GLOBAL" ? "global" : "community"}
          </span>
        )}
      </span>
      <span className="text-xs text-base-content/60">
        {tag.recipeCount} recipe{tag.recipeCount !== 1 ? "s" : ""}
      </span>
    </>
  );

  const renderCreateLabel = (input: string) => (
    <span>
      Create &quot;{input}&quot;
      {communityId && <span className="text-xs text-warning ml-1">(will be pending)</span>}
    </span>
  );

  return (
    <SearchSelector<TagSearchResult>
      value={value}
      onChange={onChange}
      searchFn={searchFn}
      placeholder={placeholder}
      chipClassName="bg-primary text-primary-content"
      allowCreate={allowCreate}
      renderSuggestion={renderSuggestion}
      renderCreateLabel={renderCreateLabel}
      noResultsMessage="No tags found"
      emptyMessage="No tags available"
    />
  );
};

export default TagSelector;
