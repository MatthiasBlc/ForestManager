import { useState } from "react";
import { AdminIngredient } from "../../models/admin";

interface IngredientApproveModalProps {
  item: AdminIngredient;
  onApprove: (newName?: string) => Promise<void>;
  onClose: () => void;
}

const IngredientApproveModal = ({ item, onApprove, onClose }: IngredientApproveModalProps) => {
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    try {
      const newName = name.trim() !== item.name ? name.trim() : undefined;
      await onApprove(newName);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Approve &amp; Rename</h3>
        <p className="text-sm text-base-content/70 mt-2">
          Approve ingredient &quot;{item.name}&quot;. Optionally change the name.
        </p>
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApprove()}
            autoFocus
          />
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={saving || !name.trim()}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : "Approve"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default IngredientApproveModal;
