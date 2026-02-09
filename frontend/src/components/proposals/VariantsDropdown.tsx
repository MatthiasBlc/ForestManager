import { useState, useEffect, useRef, useCallback } from "react";
import { FaCodeBranch, FaChevronDown, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import APIManager from "../../network/api";
import { VariantListItem } from "../../models/recipe";

interface VariantsDropdownProps {
  recipeId: string;
  currentRecipeId: string;
}

const VariantsDropdown = ({ recipeId, currentRecipeId }: VariantsDropdownProps) => {
  const [variants, setVariants] = useState<VariantListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadVariants = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await APIManager.getRecipeVariants(recipeId);
      setVariants(response.data);
    } catch {
      setVariants([]);
    } finally {
      setIsLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (variantId: string) => {
    setIsOpen(false);
    navigate(`/recipes/${variantId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return null;
  }

  if (variants.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="btn btn-outline btn-sm gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FaCodeBranch className="w-3 h-3" />
        {variants.length} variant{variants.length > 1 ? "s" : ""}
        <FaChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50">
          <div className="p-2 border-b border-base-300">
            <span className="text-sm font-medium text-base-content/70">Recipe variants</span>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {variants.map((variant) => (
              <li key={variant.id}>
                <button
                  className={`w-full text-left px-3 py-2 hover:bg-base-200 transition-colors ${
                    variant.id === currentRecipeId ? "bg-base-200" : ""
                  }`}
                  onClick={() => handleSelect(variant.id)}
                >
                  <div className="font-medium text-sm truncate">{variant.title}</div>
                  <div className="flex items-center gap-2 text-xs text-base-content/60 mt-1">
                    <FaUser className="w-3 h-3" />
                    <span>{variant.creator.username}</span>
                    <span>-</span>
                    <span>{formatDate(variant.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VariantsDropdown;
