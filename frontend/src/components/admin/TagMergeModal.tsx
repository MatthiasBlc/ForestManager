import { useState } from "react";
import { AdminTag } from "../../models/admin";

interface TagMergeModalProps {
  source: AdminTag;
  tags: AdminTag[];
  onMerge: (target: AdminTag) => Promise<void>;
  onClose: () => void;
}

const TagMergeModal = ({ source, tags, onMerge, onClose }: TagMergeModalProps) => {
  const [search, setSearch] = useState("");

  const filteredTags = tags.filter(
    (t) => t.id !== source.id && t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Merge &quot;{source.name}&quot; into...</h3>
        <p className="text-sm text-base-content/70 mt-2">
          Select the target tag. All recipes will be moved to the target.
        </p>
        <input
          type="text"
          placeholder="Search target tag..."
          className="input input-bordered input-sm w-full mt-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="mt-3 max-h-60 overflow-y-auto">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              className="btn btn-ghost btn-sm w-full justify-start mb-1"
              onClick={() => onMerge(tag)}
            >
              {tag.name} ({tag.recipeCount} recipes)
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

export default TagMergeModal;
