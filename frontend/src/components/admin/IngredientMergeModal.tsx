import { useState } from "react";
import { AdminIngredient } from "../../models/admin";

interface IngredientMergeModalProps {
  source: AdminIngredient;
  ingredients: AdminIngredient[];
  onMerge: (target: AdminIngredient) => Promise<void>;
  onClose: () => void;
}

const IngredientMergeModal = ({
  source,
  ingredients,
  onMerge,
  onClose,
}: IngredientMergeModalProps) => {
  const [search, setSearch] = useState("");

  const filtered = ingredients.filter(
    (i) => i.id !== source.id && i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Merge &quot;{source.name}&quot; into...</h3>
        <p className="text-sm text-base-content/70 mt-2">
          Select the target ingredient. All recipes will be moved to the target.
        </p>
        <input
          type="text"
          placeholder="Search target ingredient..."
          className="input input-bordered input-sm w-full mt-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="mt-3 max-h-60 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="btn btn-ghost btn-sm w-full justify-start mb-1"
              onClick={() => onMerge(item)}
            >
              {item.name} ({item.recipeCount} recipes)
            </button>
          ))}
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default IngredientMergeModal;
