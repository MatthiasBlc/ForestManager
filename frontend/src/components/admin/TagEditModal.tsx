import { useState } from "react";

interface TagEditModalProps {
  editingTag: { id: string; name: string } | null;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

const TagEditModal = ({ editingTag, onSave, onClose }: TagEditModalProps) => {
  const [tagName, setTagName] = useState(editingTag?.name ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      await onSave(tagName.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{editingTag ? "Edit Tag" : "Create Tag"}</h3>
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !tagName.trim()}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default TagEditModal;
