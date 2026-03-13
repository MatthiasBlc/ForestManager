import { useState } from "react";
import { AdminIngredient, AdminUnit } from "../../models/admin";

interface IngredientEditModalProps {
  editingItem: AdminIngredient | null;
  units: AdminUnit[];
  onSave: (name: string, defaultUnitId: string | null) => Promise<void>;
  onClose: () => void;
}

const IngredientEditModal = ({ editingItem, units, onSave, onClose }: IngredientEditModalProps) => {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [defaultUnitId, setDefaultUnitId] = useState(editingItem?.defaultUnit?.id ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), defaultUnitId || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">
          {editingItem ? "Edit Ingredient" : "Create Ingredient"}
        </h3>
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>
        <div className="form-control mt-2">
          <label className="label">
            <span className="label-text">Default Unit</span>
          </label>
          <select
            className="select select-bordered"
            value={defaultUnitId}
            onChange={(e) => setDefaultUnitId(e.target.value)}
          >
            <option value="">None</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.abbreviation})
              </option>
            ))}
          </select>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default IngredientEditModal;
