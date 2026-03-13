import { useState } from "react";
import { AdminIngredient } from "../../models/admin";

interface IngredientRejectModalProps {
  item: AdminIngredient;
  onReject: (reason: string) => Promise<void>;
  onClose: () => void;
}

const IngredientRejectModal = ({ item, onReject, onClose }: IngredientRejectModalProps) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onReject(reason.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Reject Ingredient</h3>
        <p className="text-sm text-base-content/70 mt-2">
          Reject ingredient &quot;{item.name}&quot;. This will permanently delete it and remove it
          from all recipes.
        </p>
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Reason (required)</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this ingredient is rejected..."
            rows={3}
            autoFocus
          />
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-error"
            onClick={handleReject}
            disabled={saving || !reason.trim()}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : "Reject"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default IngredientRejectModal;
